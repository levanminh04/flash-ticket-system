package com.flashticket.core.event.dto;

import com.flashticket.core.event.entity.Event;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;


public record EventResponse(
    UUID id,
    String title,
    String slug,
    String shortDescription,
    Instant startDatetime,
    Instant endDatetime,
    String venueName,
    String city,
    String bannerUrl,
    BigDecimal minPrice,
    String status,
    Boolean isFeatured,
    Integer totalCapacity,
    Integer ticketsSold
) {
    /**
     * Sử dụng denormalized fields (bannerUrl, minPrice) để tránh N+1 queries
     */
    public static EventResponse from(Event event) {
        return new EventResponse(
            event.getId(),
            event.getTitle(),
            event.getSlug(),
            event.getShortDescription(),
            event.getStartDatetime(),
            event.getEndDatetime(),
            event.getVenue() != null ? event.getVenue().getName() : null, // đã fix n + 1 query bằng @EntityGraph
            event.getVenue() != null ? event.getVenue().getCity() : null, // đã fix n + 1 query bằng @EntityGraph
            event.getBannerUrl(),  // Denormalized field
            event.getMinPrice(),   // Denormalized field
            event.getStatus().name(),
            event.getIsFeatured(),
            event.getTotalCapacity(),
            event.getTicketsSold()
        );
    }
}
