package com.flashticket.core.shared.event;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Self-contained Event (Fat Event) được publish sau khi cấp vé thành công.
 *
 * <p>Mang theo toàn bộ dữ liệu cần thiết để Consumer (EmailService) hoạt động
 * mà không cần phải gọi ngược về Database của Booking.
 */
public record TicketIssuedEvent(
    UUID orderId,
    String customerEmail,
    String customerName,
    String eventTitle,
    String eventVenueName,
    Instant eventStartDatetime,
    String orderNumber,
    List<TicketDto> tickets
) {
    public record TicketDto(
        UUID id,
        String ticketCode,
        String seatName,
        String ticketTypeName,
        String qrCodeImageUrl
    ) {}
}
