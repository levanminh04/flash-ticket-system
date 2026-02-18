package com.flashticket.core.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * DTO for Schedule information
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScheduleDTO {
    private Instant startDatetime;
    private Instant endDatetime;
    private String timezone;
    private Instant saleStartDatetime;
    private Instant saleEndDatetime;
}
