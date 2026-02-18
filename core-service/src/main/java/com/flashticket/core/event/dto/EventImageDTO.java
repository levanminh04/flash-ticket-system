package com.flashticket.core.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * DTO for Event Image information
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EventImageDTO {
    private UUID id;
    private String url;
    private String type; // BANNER, POSTER, GALLERY, THUMBNAIL
    private Boolean isPrimary;
    private Integer displayOrder;
}
