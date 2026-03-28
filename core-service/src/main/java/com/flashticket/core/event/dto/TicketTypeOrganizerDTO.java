package com.flashticket.core.event.dto;

import com.flashticket.core.event.entity.TicketType;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Response DTO cho TicketType (dành cho Organizer — bao gồm thêm quantity_reserved).
 */
@Builder
public record TicketTypeOrganizerDTO(
    UUID id,
    UUID eventId,
    UUID eventSectorId,
    String name,
    String description,
    BigDecimal price,
    BigDecimal originalPrice,
    String currency,
    Integer quantityTotal,
    Integer quantityAvailable,
    Integer quantityReserved,
    Integer maxPerOrder,
    Boolean seatSelectionEnabled,
    Instant saleStartDatetime,
    Instant saleEndDatetime,
    String colorCode,
    Integer displayOrder,
    String status,
    Boolean isVisible,
    Instant createdAt,
    Instant updatedAt
) {
    public static TicketTypeOrganizerDTO from(TicketType tt) {
        return TicketTypeOrganizerDTO.builder()
            .id(tt.getId())
            .eventId(tt.getEvent().getId())
            .eventSectorId(tt.getEventSectorId())
            .name(tt.getName())
            .description(tt.getDescription())
            .price(tt.getPrice())
            .originalPrice(tt.getOriginalPrice())
            .currency(tt.getCurrency())
            .quantityTotal(tt.getQuantityTotal())
            .quantityAvailable(tt.getQuantityAvailable())
            .quantityReserved(tt.getQuantityReserved())
            .maxPerOrder(tt.getMaxPerOrder())
            .seatSelectionEnabled(tt.getSeatSelectionEnabled())
            .saleStartDatetime(tt.getSaleStartDatetime())
            .saleEndDatetime(tt.getSaleEndDatetime())
            .colorCode(tt.getColorCode())
            .displayOrder(tt.getDisplayOrder())
            .status(tt.getStatus() != null ? tt.getStatus().name() : null)
            .isVisible(tt.getIsVisible())
            .createdAt(tt.getCreatedAt())
            .updatedAt(tt.getUpdatedAt())
            .build();
    }
}
