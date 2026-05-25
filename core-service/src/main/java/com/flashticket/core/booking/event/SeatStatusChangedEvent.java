package com.flashticket.core.booking.event;

import java.util.Map;
import java.util.UUID;

public record SeatStatusChangedEvent(
    UUID eventId,
    Map<UUID, String> seatStatuses,
    boolean replaceExisting
) {
    public SeatStatusChangedEvent(UUID eventId, Map<UUID, String> seatStatuses) {
        this(eventId, seatStatuses, false);
    }
}
