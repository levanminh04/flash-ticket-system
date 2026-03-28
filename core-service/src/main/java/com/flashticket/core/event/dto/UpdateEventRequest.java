package com.flashticket.core.event.dto;

import jakarta.validation.constraints.*;
import lombok.Builder;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Request body cho PUT /api/organizer/events/{eventId}
 *
 * Tất cả fields đều nullable — chỉ update field nào khác null.
 * Riêng startDatetime/endDatetime: bị chặn sửa nếu event đã có Order.
 */
@Builder
public record UpdateEventRequest(

    @Size(max = 255)
    String title,

    @Size(max = 500)
    String shortDescription,

    String description,

    List<String> tags,

    Instant startDatetime,
    Instant endDatetime,

    @Size(max = 50)
    String timezone,

    UUID venueId,

    Boolean isOnline,

    @Size(max = 500)
    String onlineEventUrl,

    List<UUID> categoryIds,

    Instant saleStartDatetime,
    Instant saleEndDatetime,

    @Min(1)
    Integer minTicketsPerOrder,

    @Max(100)
    Integer maxTicketsPerOrder,

    String visibility,

    @Size(max = 255)
    String metaTitle,

    @Size(max = 500)
    String metaDescription,

    @Size(max = 255)
    String metaKeywords

) {}
