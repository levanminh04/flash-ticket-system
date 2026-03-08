package com.flashticket.core.payment.service;

import com.flashticket.core.booking.entity.Order;
import com.flashticket.core.booking.repository.OrderRepository;
import com.flashticket.core.common.exception.InvalidRequestException;
import com.flashticket.core.payment.dto.PaymentInitRequest;
import com.flashticket.core.payment.dto.PaymentInitResponse;
import com.flashticket.core.payment.dto.PaymentStatusResponse;
import com.flashticket.core.payment.entity.Transaction;
import com.flashticket.core.payment.gateway.PaymentGateway;
import com.flashticket.core.payment.gateway.PaymentGatewayFactory;
import com.flashticket.core.payment.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RBucket;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Payment Service — orchestrate toàn bộ payment flow.
 * <p>
 * Chịu trách nhiệm:
 * <ol>
 *   <li>Tạo payment URL (initiatePayment) — validate → spam lock → tạo Transaction → build URL</li>
 *   <li>Query trạng thái thanh toán (getPaymentStatus) — cho frontend polling</li>
 * </ol>
 * <p>
 * Pattern tham khảo từ pg_epm CreateTransactionServiceImpl:
 * <ul>
 *   <li>Redis SetNx spam block (Guard 0) — tránh user spam nút thanh toán</li>
 *   <li>Validation ở service layer, KHÔNG ở gateway layer</li>
 *   <li>Transaction entity tạo trước khi gọi gateway — đảm bảo audit trail</li>
 * </ul>
 *
 * @see PaymentValidatorService validation logic tách riêng (SRP)
 * @see PaymentGatewayFactory Strategy pattern cho multi-gateway
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    /**
     * TTL cho Redis spam lock khi tạo payment URL.
     * <p>
     * Ngắn hơn booking spam lock (10s) vì payment URL có expire riêng (15-20 phút).
     * Chỉ cần chặn double-click trong vài giây.
     */
    private static final Duration PAYMENT_SPAM_LOCK_TTL = Duration.ofSeconds(5);

    private static final String REDIS_PAYMENT_SPAM_PREFIX = "payment:spam:";

    private final PaymentValidatorService validatorService;
    private final PaymentGatewayFactory gatewayFactory;
    private final TransactionRepository transactionRepository;
    private final OrderRepository orderRepository;
    private final RedissonClient redissonClient;

    // ────────────────────────────────────────────────────────────────────────────
    // initiatePayment — Tạo payment URL
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Tạo payment URL cho VNPay (hoặc gateway khác).

     * Flow:
     * 1. Redis spam lock (Guard 0) — chặn double-click
     * 2. Validate order (Guard 1) — IDOR, status, expiry, amount
     * 3. Tạo Transaction record (status = PENDING) — audit trail
     * 4. Update order.paymentMethod
     * 5. Gọi gateway.createPaymentUrl() — build & sign URL
     * 6. Trả PaymentInitResponse cho frontend redirect
     *
     * @return PaymentInitResponse chứa paymentUrl để frontend redirect
     */
    @Transactional
    public PaymentInitResponse initiatePayment(PaymentInitRequest request,
                                               String userId,
                                               String ipAddress) {
        UUID orderId = request.orderId();
        String provider = request.resolvedProvider();

        // ── Guard 0: Redis spam lock ─────────────────────────────────────────
        // Tham khảo pg_epm: redisService.setNx() trước mọi DB operation tránh Bug: TOCTOU race condition pattern
        String spamKey = REDIS_PAYMENT_SPAM_PREFIX + userId + ":" + orderId;
        RBucket<String> spamBucket = redissonClient.getBucket(spamKey);
        boolean isFirst = spamBucket.setIfAbsent("1", PAYMENT_SPAM_LOCK_TTL);

        if (!isFirst) {
            log.warn("[Payment] Spam detected — userId={}, orderId={}", userId, orderId);
            throw new InvalidRequestException(
                "Bạn thao tác quá nhanh. Yêu cầu thanh toán đang được xử lý. Vui lòng chờ vài giây.");
        }

        try {
            // ── Guard 1: Validate order ──────────────────────────────────────
            Order order = validatorService.validateForPayment(orderId, userId);

            // ── Tạo Transaction (PENDING) ────────────────────────────────────
            String transactionNumber = generateTransactionNumber();

            Transaction transaction = Transaction.builder()
                .transactionNumber(transactionNumber)
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .userId(userId)
                .paymentMethod(provider)
                .paymentProvider(provider)
                .amount(order.getTotalAmount())
                .currency(order.getCurrency())
                .status(Transaction.TransactionStatus.PENDING)
                .initiatedAt(Instant.now())
                .build();

            transactionRepository.save(transaction);

            log.info("[Payment] Transaction created — txnNumber={}, orderId={}, amount={}",
                transactionNumber, orderId, order.getTotalAmount());

            // ── Update order paymentMethod
            order.setPaymentMethod(provider);
            orderRepository.save(order);

            // ── Build payment URL via gateway
            PaymentGateway gateway = gatewayFactory.getGateway(provider);

            PaymentGateway.PaymentRequest gatewayRequest = new PaymentGateway.PaymentRequest(
                transactionNumber,
                order.getTotalAmount(),
                "Thanh toan don hang " + order.getOrderNumber(),
                request.bankCode()
            );

            String paymentUrl = gateway.createPaymentUrl(gatewayRequest, ipAddress);

            log.info("[Payment] Payment URL created — txnNumber={}, provider={}",
                transactionNumber, provider);

            // ── Return response
            return new PaymentInitResponse(
                transaction.getId(),
                transactionNumber,
                paymentUrl,
                order.getTotalAmount(),
                provider,
                order.getExpiresAt()
            );

        } finally {
            // Luôn release spam lock — dù thành công hay exception
            // Nếu không release: user phải chờ hết TTL (5s) mới thử lại được
            spamBucket.delete();
        }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // getPaymentStatus — Frontend polling
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Lấy trạng thái thanh toán của order.
     * <p>
     * Frontend gọi endpoint này sau khi user quay về từ VNPay.
     * Polling mỗi 2-3 giây cho đến khi orderStatus != PENDING.
     * <p>
     * IDOR protection: luôn kiểm tra userId match.
     *
     * @param orderId ID đơn hàng
     * @param userId  Keycloak subject claim
     * @return PaymentStatusResponse chứa order status + list transactions
     */
    @Transactional(readOnly = true)
    public PaymentStatusResponse getPaymentStatus(UUID orderId, String userId) {
        // IDOR protection (AI_CONTEXT rule §10)
        Order order = orderRepository.findByIdAndUserIdAndIsDeletedFalse(orderId, userId)
            .orElseThrow(() -> new com.flashticket.core.common.exception.ResourceNotFoundException(
                "Đơn hàng không tồn tại hoặc không thuộc về bạn"));

        // Lấy transactions, mới nhất trước
        var transactions = transactionRepository.findByOrderIdOrderByInitiatedAtDesc(orderId);

        var transactionSummaries = transactions.stream()
            .map(tx -> new PaymentStatusResponse.TransactionSummary(
                tx.getTransactionNumber(),
                tx.getStatus().name(),
                tx.getAmount(),
                tx.getPaymentMethod(),
                tx.getProviderResponseCode(),
                tx.getBankCode(),
                tx.getInitiatedAt(),
                tx.getCompletedAt()
            ))
            .toList();

        /**
         * User chọn vé, hệ thống tạo Order #123 (giá 500k).
         * User bấm "Thanh toán qua VNPay". Hệ thống tạo Transaction 1 (PENDING) và redirect sang VNPay.
         * Sang trang VNPay, user mở app ngân hàng ra quét QR nhưng ngập ngừng... quyết định bấm nút "Hủy thanh toán" quay lại trang Flash Ticket.
         * VNPay gọi IPN trả về code huỷ (ví dụ "24"). Transaction 1 → FAILED / CANCELLED. Order #123 vẫn PENDING (vì hệ thống giữ vé cho user 15 phút).
         * Quy định của VNPay: VNPay bắt buộc mỗi lần tạo URL thanh toán phải có một vnp_TxnRef unique.
         * Nếu user ấn nút thanh toán 10 lần cho cùng 1 đơn hàng, bạn BẮT BUỘC phải tạo ra 10 cái Transaction record khác nhau trỏ về cùng 1 Order.
         * */

        return new PaymentStatusResponse(
            order.getId(),
            order.getStatus().name(),
            order.getTotalAmount(),
            transactionSummaries
        );
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Generate unique transaction number — format: "TXN-{yyyyMMddHHmmss}-{6 random digits}"
     * <p>
     * Ví dụ: "TXN-20260306103045-482931"
     * <p>
     * Giống pattern orderNumber (TB-YYYYMMDD-6digits) nhưng prefix khác + thêm time.
     * Uniqueness đảm bảo bởi UNIQUE constraint trên DB.
     * Dùng làm vnp_TxnRef — VNPay yêu cầu mỗi request unique.
     */
    private String generateTransactionNumber() {
        String timePart = LocalDateTime.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"))
            .format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        int randomPart = ThreadLocalRandom.current().nextInt(100000, 999999);
        return "TXN-" + timePart + "-" + randomPart;
    }
}
