package com.flashticket.core.booking.dto;

import com.flashticket.core.booking.entity.Order;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Response cho POST /api/bookings — trả về ngay sau khi tạo order thành công.
 * Chứa đủ thông tin để frontend:
 * 1. Hiển thị order summary
 * 2. Bắt đầu countdown timer (expiresAt)
 * 3. Gọi tiếp POST /api/payments/create-url với orderId
 */
public record BookingResponse(

    UUID orderId,
    String orderNumber,

    /** Tổng trước giảm giá */
    BigDecimal subtotal,

    /** Số tiền được giảm (0 nếu không có voucher) */
    BigDecimal discountAmount,

    /** Tổng phải thanh toán = subtotal - discountAmount */
    BigDecimal totalAmount,

    String currency,

    /** Thời điểm order hết hạn (15 phút từ lúc tạo) */
    Instant expiresAt,

    Order.OrderStatus status,

    List<OrderItemDTO> items

) {

    /** Factory method từ entity */
    public static BookingResponse from(Order order, List<OrderItemDTO> items) {
        return new BookingResponse(
            order.getId(),
            order.getOrderNumber(),
            order.getSubtotal(),
            order.getDiscountAmount(),
            order.getTotalAmount(),
            order.getCurrency(),
            order.getExpiresAt(),
            order.getStatus(),
            items
        );
    }
}
