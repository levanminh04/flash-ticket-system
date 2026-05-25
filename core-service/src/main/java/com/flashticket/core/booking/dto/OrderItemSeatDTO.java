package com.flashticket.core.booking.dto;

import com.flashticket.core.booking.entity.OrderItemSeat;

import java.math.BigDecimal;
import java.util.UUID;

public record OrderItemSeatDTO(
    UUID seatId,
    String seatLabel,
    String rowName,
    String seatNumber,
    BigDecimal price,
    String status
) {
    public static OrderItemSeatDTO from(OrderItemSeat seat) {
        return new OrderItemSeatDTO(
            seat.getSeatId(),
            seat.getSeatLabel(),
            seat.getRowName(),
            seat.getSeatNumber(),
            seat.getPrice(),
            seat.getStatus().name()
        );
    }
}
