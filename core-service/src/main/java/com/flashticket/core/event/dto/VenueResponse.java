package com.flashticket.core.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Phản hồi thông tin địa điểm (Venue)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VenueResponse {
    private UUID id;
    private String name;
    private String slug;
    private String description;
    private String address;
    private String district;
    private String city;
    private BigDecimal latitude;
    private BigDecimal longitude;
    private Integer totalCapacity;
    private List<String> facilities;
    private List<String> imageUrls;
}
