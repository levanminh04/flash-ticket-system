package com.flashticket.core.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO cho Event Search Request
 * Chứa tất cả filters có thể dùng khi search events
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EventSearchRequest {
    
    /**
     * Tìm kiếm theo title (partial match, case-insensitive)
     * Example: "rock" → tìm "Rock Storm", "Rock Festival", etc.
     */
    private String search;
    
    private String city;
    
    /**
     * Filter theo category slug
     * Example: "am-nhac", "the-thao"
     */
    private String category;
    
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate startDate;
    
    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate endDate;
    
    private BigDecimal minPrice;
    
    private BigDecimal maxPrice;
    
    /**
     * true = chỉ featured events
     * false = chỉ non-featured events
     * null = tất cả events
     */
    private Boolean isFeatured;
}
