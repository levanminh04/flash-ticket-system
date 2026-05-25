package com.flashticket.core.booking.dto;

import com.flashticket.core.booking.entity.OrderItem;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Chi tiết 1 dòng trong order response */
public record OrderItemDTO(

    UUID id,
    UUID ticketTypeId,
    String ticketTypeName,
    String sectorName,
    int quantity,
    BigDecimal unitPrice,
    BigDecimal subtotal,
    List<OrderItemSeatDTO> seats

) {
    public static OrderItemDTO from(OrderItem item) {
        return from(item, List.of());
    }

    public static OrderItemDTO from(OrderItem item, List<OrderItemSeatDTO> seats) {
        return new OrderItemDTO(
            item.getId(),
            item.getTicketTypeId(),
            item.getTicketTypeName(),
            item.getSectorName(),
            item.getQuantity(),
            item.getUnitPrice(),
            item.getSubtotal(),
            seats
        );
    }
}
