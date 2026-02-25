package com.flashticket.core.booking.dto;

import com.flashticket.core.booking.entity.OrderItem;

import java.math.BigDecimal;
import java.util.UUID;

/** Chi tiết 1 dòng trong order response */
public record OrderItemDTO(

    UUID id,
    UUID ticketTypeId,
    String ticketTypeName,
    String sectorName,
    int quantity,
    BigDecimal unitPrice,
    BigDecimal subtotal

) {
    public static OrderItemDTO from(OrderItem item) {
        return new OrderItemDTO(
            item.getId(),
            item.getTicketTypeId(),
            item.getTicketTypeName(),
            item.getSectorName(),
            item.getQuantity(),
            item.getUnitPrice(),
            item.getSubtotal()
        );
    }
}
