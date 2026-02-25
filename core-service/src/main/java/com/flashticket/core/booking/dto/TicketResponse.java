package com.flashticket.core.booking.dto;

import com.flashticket.core.booking.entity.Ticket;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Response cho GET /api/tickets/{id} và GET /api/tickets/my-tickets
 *
 * qrCodeData là chuỗi raw — frontend dùng thư viện (e.g. qrcode.react) để render thành ảnh.
 * Không trả base64 ảnh để giảm payload size; frontend render phía client.
 */
public record TicketResponse(

    UUID id,
    String ticketCode,

    UUID orderId,
    UUID eventId,
    String eventTitle,
    Instant eventStartDatetime,
    String eventVenueName,

    UUID ticketTypeId,
    String ticketTypeName,

    /** Ghế chỉ có giá trị khi là seated ticket */
    String seatLabel,

    String holderName,
    String holderEmail,

    BigDecimal price,

    /**
     * QR data đã được ký HMAC — frontend decode để render QR code.
     * Format: "{ticketCode}|{eventId}|{ticketTypeId}|{signature}"
     */
    String qrCodeData,

    Ticket.TicketStatus status,
    Instant checkedInAt,
    Instant createdAt

) {
    public static TicketResponse from(Ticket ticket) {
        return new TicketResponse(
            ticket.getId(),
            ticket.getTicketCode(),
            ticket.getOrderId(),
            ticket.getEventId(),
            ticket.getEventTitle(),
            ticket.getEventStartDatetime(),
            ticket.getEventVenueName(),
            ticket.getTicketTypeId(),
            ticket.getTicketTypeName(),
            ticket.getSeatLabel(),
            ticket.getHolderName(),
            ticket.getHolderEmail(),
            ticket.getPrice(),
            ticket.getQrCodeData(),
            ticket.getStatus(),
            ticket.getCheckedInAt(),
            ticket.getCreatedAt()
        );
    }
}
