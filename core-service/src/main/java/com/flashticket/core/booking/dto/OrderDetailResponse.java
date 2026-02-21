package com.flashticket.core.booking.dto;

import com.flashticket.core.booking.entity.Order;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Response đầy đủ cho GET /api/orders/{id}
 * Bao gồm thông tin event (snapshot) và danh sách items.
 */
public record OrderDetailResponse(

    UUID id,
    String orderNumber,

    // Customer snapshot
    String customerName,
    String customerEmail,
    String customerPhone,

    // Event snapshot
    UUID eventId,
    String eventTitle,
    Instant eventStartDatetime,
    String eventVenueName,

    // Pricing
    BigDecimal subtotal,
    BigDecimal discountAmount,
    BigDecimal totalAmount,
    String currency,
    String promotionCode,

    // Status
    Order.OrderStatus status,
    String paymentMethod,
    Instant paidAt,
    Instant expiresAt,
    Instant createdAt,

    String customerNote,
    List<OrderItemDTO> items

) {
    public static OrderDetailResponse from(Order order, List<OrderItemDTO> items) {
        return new OrderDetailResponse(
            order.getId(),
            order.getOrderNumber(),
            order.getCustomerName(),
            order.getCustomerEmail(),
            order.getCustomerPhone(),
            order.getEventId(),
            order.getEventTitle(),
            order.getEventStartDatetime(),
            order.getEventVenueName(),
            order.getSubtotal(),
            order.getDiscountAmount(),
            order.getTotalAmount(),
            order.getCurrency(),
            order.getPromotionCode(),
            order.getStatus(),
            order.getPaymentMethod(),
            order.getPaidAt(),
            order.getExpiresAt(),
            order.getCreatedAt(),
            order.getCustomerNote(),
            items
        );
    }
}
