package com.flashticket.core.payment.service;

import com.flashticket.core.booking.entity.Order;
import com.flashticket.core.booking.repository.OrderRepository;
import com.flashticket.core.booking.service.TicketIssuanceService;
import com.flashticket.core.shared.messaging.RabbitMQConstants;
import com.flashticket.core.payment.entity.Transaction;
import com.flashticket.core.payment.gateway.PaymentGateway;
import com.flashticket.core.payment.gateway.PaymentGatewayFactory;
import com.flashticket.core.payment.gateway.VNPayResponseCode;
import com.flashticket.core.shared.event.PaymentSuccessEvent;
import com.flashticket.core.payment.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RBucket;
import org.redisson.api.RedissonClient;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.interceptor.TransactionAspectSupport;

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
    private final RabbitTemplate rabbitTemplate;
    private final ApplicationEventPublisher eventPublisher;
    private final TicketIssuanceService ticketIssuanceService;

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
            // Tìm Transaction
            var transactionOpt = transactionRepository.findByTransactionNumberForUpdate(txnRef);
            if (transactionOpt.isEmpty()) {
                log.warn("[VNPay IPN] Transaction not found — txnRef={}", txnRef);
                return VNPayResponseCode.ORDER_NOT_FOUND.toResponse();
            }

            Transaction transaction = transactionOpt.get();

            // Check đã xử lý chưa (reject sớm, tiết kiệm CPU) ────
            if (transaction.getStatus() != Transaction.TransactionStatus.PENDING) {
                log.info("[VNPay IPN] Transaction already processed — txnRef={}, status={}",
                    txnRef, transaction.getStatus());
                return VNPayResponseCode.ORDER_ALREADY_CONFIRMED.toResponse();
            }

            // Verify HMAC signature
            PaymentGateway gateway = gatewayFactory.getGateway("VNPAY");
            if (!gateway.verifyCallback(params)) {
                log.error("[VNPay IPN] SIGNATURE FAILED — txnRef={}", txnRef);
                return VNPayResponseCode.SIGNATURE_FAILED.toResponse();
            }

            // Parse result + verify amount
            PaymentGateway.PaymentResult result = gateway.parseCallbackResult(params);

            if (!validatorService.validateAmount(transaction.getAmount(), result.amount())) {
                log.error("[VNPay IPN] AMOUNT MISMATCH — txnRef={}, expected={}, actual={}",
                    txnRef, transaction.getAmount(), result.amount());
                return VNPayResponseCode.INVALID_AMOUNT.toResponse();
            }

            // Update Transaction
            updateTransaction(transaction, result);

            // Update Order (nếu payment thành công)
            if (result.isSuccess()) {
                Order order = orderRepository.findByIdForUpdate(transaction.getOrderId())
                    .orElseThrow(() -> new IllegalStateException("Order not found: " + transaction.getOrderId()));
                if (order.getStatus() != Order.OrderStatus.PENDING) {
                    recordLateSuccessWithoutIssuance(transaction, result, order.getStatus());
                    log.warn("[VNPay IPN] Payment arrived for non-payable order — txnRef={}, orderId={}, status={}",
                        txnRef, order.getId(), order.getStatus());
                    return VNPayResponseCode.ORDER_ALREADY_CONFIRMED.toResponse();
                }

                confirmLockedOrder(order);
                ticketIssuanceService.issueTickets(order.getId());
                // Publish local event -> TransactionalEventListener sẽ bắt và gửi lên RabbitMQ SAU KHI commit DB
                // ApplicationEventPublisher đẩy event này vào một event bus nội bộ
                eventPublisher.publishEvent(new PaymentSuccessEvent(transaction.getOrderId()));
                log.info("[VNPay IPN] Payment SUCCESS — txnRef={}, orderId={}, amount={}",
                    txnRef, transaction.getOrderId(), result.amount());
            } else {
                log.warn("[VNPay IPN] Payment FAILED — txnRef={}, responseCode={}",
                    txnRef, result.responseCode());
            }

            return VNPayResponseCode.SUCCESS.toResponse();

        } catch (Exception e) {
            log.error("[VNPay IPN] Processing error — txnRef={}: {}", txnRef, e.getMessage(), e);
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
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

    private void recordLateSuccessWithoutIssuance(
        Transaction transaction,
        PaymentGateway.PaymentResult result,
        Order.OrderStatus orderStatus
    ) {
        transaction.setProviderTransactionId(result.providerTransactionId());
        transaction.setProviderResponseCode(result.responseCode());
        transaction.setBankCode(result.bankCode());
        transaction.setCardType(result.cardType());
        transaction.setCompletedAt(Instant.now());
        transaction.setProviderRawResponse(
            result.rawParams().entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue))
        );
        transaction.setStatus(Transaction.TransactionStatus.CANCELLED);
        transaction.setProviderResponseMessage(
            "Payment success received after order became " + orderStatus + "; ticket was not issued");
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
    private void confirmLockedOrder(Order order) {
        order.setStatus(Order.OrderStatus.CONFIRMED);
        order.setPaidAt(Instant.now());
        orderRepository.save(order);
        log.info("[VNPay IPN] Order confirmed â€” orderId={}", order.getId());
    }

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

    /**
     * Listener bắt sự kiện PaymentSuccessEvent NỘI BỘ sau khi DB đã COMMIT THÀNH CÔNG.
     * Giải quyết triệt để lỗi đua đồng bộ (Phantom Message/Read) khi gửi RabbitMQ.

     KHÔNG có @Async:

     Tomcat thread:
     processIPN()
     └─ @Transactional commit
        └─ AFTER_COMMIT: gọi handlePaymentSuccessEvent() BLOCKING trên cùng thread
            └─ rabbitTemplate.convertAndSend() ← nếu lag 2s thì Tomcat thread chờ 2s
                └─ return response về VNPay  ← lúc này mới trả về (trễ 2s)
     */
    // @EventListener hay @TransactionalEventListener định tuyến (route) các sự kiện dựa trên kiểu dữ liệu của tham số truyền vào hàm.
    // nếu tham số không phải PaymentSuccessEvent thì handlePaymentSuccessEvent() sẽ không trigger
    @Async("paymentAsyncExecutor") // Cần thêm @Async	Để đảm bảo response IPN cho VNPAY < 3s trong trường hợp RabbitMQ lag.
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handlePaymentSuccessEvent(PaymentSuccessEvent event) {
        try {
            rabbitTemplate.convertAndSend(
                RabbitMQConstants.EXCHANGE_PAYMENT,
                RabbitMQConstants.RK_PAYMENT_SUCCESS,
                event
            );
            log.info("[VNPay IPN] Published PaymentSuccessEvent to RabbitMQ (After DB Commit) — orderId={}", event.orderId());
        } catch (Exception e) {
            // Không cho lỗi publish RabbitMQ ảnh hưởng response IPN về VNPay
            // Order đã CONFIRMED trong DB — có thể manual trigger lại sau
            log.error("[VNPay IPN] Failed to publish PaymentSuccessEvent to RabbitMQ — orderId={}: {}",
                event.orderId(), e.getMessage(), e);
        }
    }
//    @Async
    /**
     * Bình thường, khi method A gọi method B → B chạy trên cùng thread với A.
     * Khi method B có @Async → Spring sẽ không chạy B ngay, mà đẩy nhiệm vụ (task) vào một Thread Pool (bể luồng),
     * rồi trả quyền kiểm soát lại cho thread A ngay lập tức.
     * Nếu rabbitTemplate.convertAndSend() chậm (RabbitMQ lag, network chậm, queue đầy…)
     *      → Tomcat thread bị block vài giây.
     * Response về VNPay bị trễ → VNPay timeout và retry IPN → rất nguy hiểm.
     *
     * Spring dùng cơ chế TransactionSynchronization để theo dõi từng transaction riêng biệt.
     * Khi gọi publishEvent(eventA), Spring đăng ký eventA với transaction hiện tại của thread đó.
     * Khi transaction commit → Spring chỉ kích hoạt listener cho đúng event đó.
     * Khi listener chạy @Async, nó vẫn nhận được event object gốc (đã được copy hoặc reference an toàn).
     *
     * */



}
