package com.flashticket.core.booking.dto;

import com.flashticket.core.booking.entity.Order;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Summary item trong danh sách GET /api/orders/my-orders
 * Không có items detail để giảm payload size.
 */
public record OrderSummaryDTO(

    UUID id,
    String orderNumber,
    UUID eventId,
    String eventTitle,
    Instant eventStartDatetime,
    BigDecimal totalAmount,
    String currency,
    Order.OrderStatus status,
    String paymentMethod,
    Instant createdAt,
    Instant expiresAt

) {
    public static OrderSummaryDTO from(Order order) {
        return new OrderSummaryDTO(
            order.getId(),
            order.getOrderNumber(),
            order.getEventId(),
            order.getEventTitle(),
            order.getEventStartDatetime(),
            order.getTotalAmount(),
            order.getCurrency(),
            order.getStatus(),
            order.getPaymentMethod(),
            order.getCreatedAt(),
            order.getExpiresAt()
        );
    }
}
