package com.flashticket.core.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * DTO for Ticket Type information
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TicketTypeDTO {
    private UUID id;
    private String name;
    private String description;
    private BigDecimal price;
    private BigDecimal originalPrice;
    private String currency;
    private Integer quantityTotal;
    private Integer quantityAvailable;
    private Integer maxPerOrder;
    private Instant saleStartDatetime;
    private Instant saleEndDatetime;
    private Boolean seatSelectionEnabled;
    private String status;
    private String colorCode;
    private Integer displayOrder;
}
