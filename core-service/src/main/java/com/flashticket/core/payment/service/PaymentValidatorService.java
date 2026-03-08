package com.flashticket.core.payment.service;

import com.flashticket.core.booking.entity.Order;
import com.flashticket.core.booking.repository.OrderRepository;
import com.flashticket.core.common.exception.InvalidRequestException;
import com.flashticket.core.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Validation logic tách riêng khỏi PaymentService — Single Responsibility.
 * <p>
 * Tham khảo pg_epm: validation nằm ở CreateTransactionServiceImpl (tầng trên) và
 * VNPayServiceImpl (tầng service), không nằm trong adapter/gateway.
 * Flash Ticket gộp validation vào 1 class duy nhất vì chỉ có 1 merchant.
 * <p>
 * Mỗi method throw exception rõ ràng nếu validation fail — PaymentService
 * chỉ cần gọi và không cần xử lý logic validation.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentValidatorService {

    private final OrderRepository orderRepository;

    /**
     * Validate đầy đủ trước khi tạo payment URL.
     * Thứ tự validate (reject sớm nhất → tiết kiệm CPU):
     * <ol>
     *   Order tồn tại
     *   Order thuộc về user hiện tại (IDOR protection)
     *   Order status = PENDING
     *   Order chưa hết hạn (expiresAt)
     *   totalAmount > 0
     * </ol>
     *
     * @param orderId ID đơn hàng
     * @param userId  Keycloak subject claim của user hiện tại
     * @return Order entity đã validate — dùng trực tiếp, không cần query lại
     */
    public Order validateForPayment(UUID orderId, String userId) {
        // 1. Order tồn tại + thuộc về user (IDOR protection — AI_CONTEXT rule §10)
        Order order = orderRepository.findByIdAndUserIdAndIsDeletedFalse(orderId, userId)
            .orElseThrow(() -> {
                log.warn("[Payment] Order không tìm thấy hoặc không thuộc về user. orderId={}, userId={}",
                    orderId, userId);
                return new ResourceNotFoundException("Đơn hàng không tồn tại hoặc không thuộc về bạn");
            });

        // 2. Status = PENDING — chưa thanh toán, chưa cancel, chưa expired
        if (order.getStatus() != Order.OrderStatus.PENDING) {
            log.warn("[Payment] Order không ở trạng thái PENDING. orderId={}, status={}",
                orderId, order.getStatus());
            throw new InvalidRequestException(
                "Đơn hàng không ở trạng thái chờ thanh toán. Trạng thái hiện tại: " + order.getStatus());
        }

        // 3. Chưa hết hạn — Order có TTL (ví dụ 15 phút từ lúc booking)
        if (order.getExpiresAt() != null && order.getExpiresAt().isBefore(Instant.now())) {
            log.warn("[Payment] Order đã hết hạn. orderId={}, expiresAt={}",
                orderId, order.getExpiresAt());
            throw new InvalidRequestException(
                "Đơn hàng đã hết hạn thanh toán. Vui lòng tạo đơn hàng mới.");
        }

        // 4. Số tiền hợp lệ
        if (order.getTotalAmount() == null || order.getTotalAmount().compareTo(BigDecimal.ZERO) <= 0) {
            log.warn("[Payment] Số tiền thanh toán không hợp lệ. orderId={}, amount={}",
                orderId, order.getTotalAmount());
            throw new InvalidRequestException(
                "Số tiền thanh toán không hợp lệ");
        }

        log.info("[Payment] Validation passed. orderId={}, amount={}, userId={}",
            orderId, order.getTotalAmount(), userId);

        return order;
    }

    /**
     * Validate amount từ VNPay IPN callback khớp với order amount.
     * <p>
     * Quan trọng: VNPay gửi amount đã chia 100 (trong PaymentResult) —
     * VNPayGateway.parseCallbackResult() đã xử lý chia 100 rồi.
     * So sánh trực tiếp với order.totalAmount là đúng.
     *
     * @param expectedAmount Số tiền order trong DB
     * @param actualAmount   Số tiền VNPay callback (đã chia 100 bởi VNPayGateway)
     * @return true nếu khớp
     */
    public boolean validateAmount(BigDecimal expectedAmount, BigDecimal actualAmount) {
        // Dùng compareTo thay vì equals — vì BigDecimal("100.00").equals("100") = false
        boolean match = expectedAmount.compareTo(actualAmount) == 0;
        if (!match) {
            log.error("[Payment] Amount mismatch! expected={}, actual={}",
                expectedAmount, actualAmount);
        }
        return match;
    }
}
