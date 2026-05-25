package com.flashticket.core.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SeatMapResponse {
    private UUID layoutId;
    private String backgroundImageUrl;
    private Integer backgroundWidth;
    private Integer backgroundHeight;
    private Map<String, Object> mapConfig;
    private List<SectorDto> sectors;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SectorDto {
        private UUID id;
        private String name;
        private String code;
        private String sectorType;
        private Integer totalCapacity;
        private Map<String, Object> mapData;
        private String colorCode;
        private Integer displayOrder;
        private Boolean isActive;
        private List<SeatDto> seatsData;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SeatDto {
        private UUID id;
        private String rowName;
        private String seatNumber;
        private String seatLabel;
        private BigDecimal coordX;
        private BigDecimal coordY;
        private UUID ticketTypeId;
        private BigDecimal price;
        private String colorCode;
        private String seatType;
        private Boolean isActive;
        private String inventoryStatus; // AVAILABLE, SOLD, LOCKED, RESERVED
    }
}
