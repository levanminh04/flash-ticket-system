package com.flashticket.core.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for Statistics information
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StatisticsDTO {
    private Integer viewCount;
    private Integer ticketsSold;
    private Integer totalCapacity;
}
