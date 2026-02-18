package com.flashticket.core.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * DTO for Venue information
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VenueDTO {
    private UUID id;
    private String name;
    private String slug;
    private String address;
    private String city;
    private Double latitude;
    private Double longitude;
    private Integer totalCapacity;
    private List<String> facilities; // From JSONB
}
