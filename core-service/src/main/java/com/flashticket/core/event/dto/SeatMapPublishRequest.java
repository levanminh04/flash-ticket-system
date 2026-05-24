package com.flashticket.core.event.dto;

import lombok.Builder;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Builder
public record SeatMapPublishRequest(
    String name,
    String backgroundImageUrl,
    String backgroundPublicId,
    Integer backgroundWidth,
    Integer backgroundHeight,
    Map<String, Object> mapConfig,
    List<@Valid SectorPayload> sectors
) {

    @Builder
    public record SectorPayload(
        UUID id,
        String name,
        String code,
        String sectorType,
        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "sector.colorCode must use #RRGGBB format")
        String colorCode,
        Integer totalCapacity,
        Boolean visible,
        Integer displayOrder,
        Map<String, Object> mapData,
        List<SeatPayload> seats
    ) {}

    @Builder
    public record SeatPayload(
        UUID id,
        String rowName,
        String seatNumber,
        String seatLabel,
        BigDecimal coordX,
        BigDecimal coordY,
        UUID ticketTypeId,
        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "seat.colorCode must use #RRGGBB format")
        String colorCode,
        String seatType,
        Boolean isActive,
        Map<String, Object> coordMetadata
    ) {}
}
