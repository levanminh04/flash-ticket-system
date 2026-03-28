package com.flashticket.core.event.dto;

import com.flashticket.core.event.entity.EventImage;
import jakarta.validation.constraints.Size;
import lombok.Builder;

/**
 * Request để cập nhật metadata của EventImage (alt text, order, isPrimary)
 */
@Builder
public record UpdateImageRequest(
    
    @Size(max = 255)
    String altText,
    
    Integer displayOrder,
    
    Boolean isPrimary,
    
    EventImage.ImageType imageType
) {}
