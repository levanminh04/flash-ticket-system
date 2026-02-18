package com.flashticket.core.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for Config information
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConfigDTO {
    private Integer minTicketsPerOrder;
    private Integer maxTicketsPerOrder;
    private String visibility;
}
