package com.flashticket.core.payment.service;

import com.flashticket.core.booking.entity.Order;
import com.flashticket.core.booking.repository.OrderRepository;
import com.flashticket.core.payment.entity.Transaction;
import com.flashticket.core.payment.gateway.PaymentGateway;
import com.flashticket.core.payment.gateway.PaymentGatewayFactory;
import com.flashticket.core.payment.gateway.VNPayResponseCode;
import com.flashticket.core.payment.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RBucket;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * VNPay IPN (Instant Payment Notification) Processing Service.
 * <p>
 * Xử lý callback từ VNPay khi user thanh toán xong.
 * Đây là phần CRITICAL nhất của payment flow — sai ở đây = mất tiền hoặc issue vé trùng.
 * <p>
 * Flow xử lý (thứ tự tham khảo pg_epm VNPayServiceImpl.vnPayIPN()):
 * <pre>
 * 1. Redis SetNx idempotency lock       → chặn xử lý trùng lặp
 * 2. Tìm Transaction theo vnp_TxnRef    → ORDER_NOT_FOUND nếu không thấy
 * 3. Check Transaction status != PENDING → ORDER_ALREADY_CONFIRMED nếu đã xử lý
 * 4. Verify HMAC-SHA512 signature        → SIGNATURE_FAILED nếu giả mạo
 * 5. Verify amount khớp                  → INVALID_AMOUNT nếu bị tamper
 * 6. Update Transaction + Order status   → SUCCESS hoặc FAILED tùy vnp_ResponseCode
 * </pre>
 * <p>
 * Tại sao check status TRƯỚC verify HMAC?
 * <ul>
 *   <li>HMAC tính toán tốn CPU (SHA512 hashing)</li>
 *   <li>Nếu transaction đã xử lý rồi → reject ngay, tiết kiệm CPU</li>
 *   <li>pg_epm cũng áp dụng thứ tự này (VNPayServiceImpl dòng 193-202)</li>
 * </ul>
 *
 * @see VNPayResponseCode enum response codes
 * @see PaymentValidatorService#validateAmount(java.math.BigDecimal, java.math.BigDecimal)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class VNPayIPNService {

    /**
     * TTL cho Redis idempotency lock.
     * <p>
     * 30 giây — đủ dài để xử lý xong IPN (thường < 1 giây).
     * Nếu thread bị crash giữa chừng, lock tự hết hạn sau 30s, VNPay retry sẽ được xử lý.
     * <p>
     * Tham khảo pg_epm: RedisConstant.RedisLockTime.LEASE_TIME = 30
     */
    private static final Duration IPN_LOCK_TTL = Duration.ofSeconds(30);
    private static final String REDIS_IPN_LOCK_PREFIX = "vnpay:ipn:";

    private final TransactionRepository transactionRepository;
    private final OrderRepository orderRepository;
    private final PaymentGatewayFactory gatewayFactory;
    private final PaymentValidatorService validatorService;
    private final RedissonClient redissonClient;

    /**
     * Xử lý VNPay IPN callback.
     * Method này PHẢI trả về response nhanh (< 3 giây) — nếu không VNPay sẽ timeout và retry.
     * Vì vậy TẤT CẢ logic nặng (issue tickets, gửi email) phải chạy async sau khi return.
     * @param params Tất cả query params VNPay gửi về
     * @return Map{"RspCode":"XX","Message":"..."} — format VNPay yêu cầu
     */
    @Transactional
    public Map<String, String> processIPN(Map<String, String> params) {
        String txnRef = params.get("vnp_TxnRef");

        // ── Step 1: Redis idempotency lock
        // pg_epm pattern: redisService.setNx(redisKey, redisKey, 30)
        String lockKey = REDIS_IPN_LOCK_PREFIX + txnRef;
        RBucket<String> lockBucket = redissonClient.getBucket(lockKey);
        boolean isFirst = lockBucket.setIfAbsent("processing", IPN_LOCK_TTL);

        if (!isFirst) {
            log.info("[VNPay IPN] Duplicate IPN detected, already processing — txnRef={}", txnRef);
            // Trả "00" để VNPay không retry tiếp — transaction đang được xử lý ở thread khác
            return VNPayResponseCode.SUCCESS.toResponse();
        }

        /**
         * kịch bản:
         * Thread 1: Chiếm được Lock (isFirst = true), đang chạy thì DB lỗi hoặc Server sập.
         * Thread 2: (Đến ngay sau đó) Thấy Lock đang bận (isFirst = false) ➔ Trả về SUCCESS và kết thúc.
         * Nhưng: Nếu Thread 1 (luồng thực sự xử lý) gặp lỗi và không trả về được mã "00" cho VNPay (do Server sập hoặc Exception), VNPay sẽ coi như lần gọi đó thất bại.
         * => VNPay retry => không lo IPN không được gọi lại nếu lỗi update DB giữa chừng
         * */
        try {
            // ── Step 2: Tìm Transaction
            var transactionOpt = transactionRepository.findByTransactionNumber(txnRef);
            if (transactionOpt.isEmpty()) {
                log.warn("[VNPay IPN] Transaction not found — txnRef={}", txnRef);
                return VNPayResponseCode.ORDER_NOT_FOUND.toResponse();
            }

            Transaction transaction = transactionOpt.get();

            // ── Step 3: Check đã xử lý chưa (reject sớm, tiết kiệm CPU) ────
            if (transaction.getStatus() != Transaction.TransactionStatus.PENDING) {
                log.info("[VNPay IPN] Transaction already processed — txnRef={}, status={}",
                    txnRef, transaction.getStatus());
                return VNPayResponseCode.ORDER_ALREADY_CONFIRMED.toResponse();
            }

            // ── Step 4: Verify HMAC signature
            PaymentGateway gateway = gatewayFactory.getGateway("VNPAY");
            if (!gateway.verifyCallback(params)) {
                log.error("[VNPay IPN] SIGNATURE FAILED — txnRef={}", txnRef);
                return VNPayResponseCode.SIGNATURE_FAILED.toResponse();
            }

            // ── Step 5: Parse result + verify amount ─────────────────────────
            PaymentGateway.PaymentResult result = gateway.parseCallbackResult(params);

            if (!validatorService.validateAmount(transaction.getAmount(), result.amount())) {
                log.error("[VNPay IPN] AMOUNT MISMATCH — txnRef={}, expected={}, actual={}",
                    txnRef, transaction.getAmount(), result.amount());
                return VNPayResponseCode.INVALID_AMOUNT.toResponse();
            }

            // ── Step 6: Update Transaction
            updateTransaction(transaction, result);

            // ── Step 7: Update Order (nếu payment thành công)
            if (result.isSuccess()) {
                confirmOrder(transaction.getOrderId());
                log.info("[VNPay IPN] Payment SUCCESS — txnRef={}, orderId={}, amount={}",
                    txnRef, transaction.getOrderId(), result.amount());
            } else {
                log.warn("[VNPay IPN] Payment FAILED — txnRef={}, responseCode={}",
                    txnRef, result.responseCode());
            }

            return VNPayResponseCode.SUCCESS.toResponse();

        } catch (Exception e) {
            log.error("[VNPay IPN] Processing error — txnRef={}: {}", txnRef, e.getMessage(), e);
            return VNPayResponseCode.UNKNOWN_ERROR.toResponse();
        } finally {
            // Luôn release lock
            lockBucket.delete();
        }
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Update Transaction entity với kết quả từ VNPay.
     */
    private void updateTransaction(Transaction transaction, PaymentGateway.PaymentResult result) {
        transaction.setProviderTransactionId(result.providerTransactionId());
        transaction.setProviderResponseCode(result.responseCode());
        transaction.setBankCode(result.bankCode());
        transaction.setCardType(result.cardType());
        transaction.setCompletedAt(Instant.now());

        // Lưu toàn bộ raw params vào JSONB — audit trail
        // Convert Map<String,String> → Map<String,Object> cho JsonType
        // tránh bug  Stale Object Reference, Dirty Write / Unintended Persistence, Dirty Checking của Hibernate
        transaction.setProviderRawResponse(
            result.rawParams().entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue))
        );

        if (result.isSuccess()) {
            transaction.setStatus(Transaction.TransactionStatus.SUCCESS);
        } else {
            transaction.setStatus(Transaction.TransactionStatus.FAILED);
            transaction.setProviderResponseMessage(
                "VNPay response code: " + result.responseCode());
        }

        transactionRepository.save(transaction);
    }

    /**
     * Confirm order sau khi payment thành công.
     * <p>
     * PENDING → CONFIRMED + set paidAt.
     * <p>
     * Chỉ confirm nếu order vẫn đang PENDING — double safety net
     * (trường hợp edge case: 2 IPN đến gần nhau, cả 2 qua Redis lock).
     */
    private void confirmOrder(UUID orderId) {
        orderRepository.findById(orderId).ifPresent(order -> {
            if (order.getStatus() == Order.OrderStatus.PENDING) {
                order.setStatus(Order.OrderStatus.CONFIRMED);
                order.setPaidAt(Instant.now());
                orderRepository.save(order);
                log.info("[VNPay IPN] Order confirmed — orderId={}", orderId);
            } else {
                log.warn("[VNPay IPN] Order not PENDING, skip confirm — orderId={}, status={}",
                    orderId, order.getStatus());
            }
        });
    }
}
