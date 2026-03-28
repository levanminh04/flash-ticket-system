package com.flashticket.core.event.dto;

import com.flashticket.core.event.entity.EventLayout;
import com.flashticket.core.event.entity.EventLayout.SourceType;
import lombok.Builder;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Builder
public record EventLayoutRequest(

    String name,

    String backgroundImageUrl,

    String backgroundPublicId,

    Integer backgroundWidth,

    Integer backgroundHeight,

    /**
     * Config cho Map renderer: minZoom, maxZoom, defaultZoom, gridSize, viewport...
     * Cấu trúc linh hoạt, Frontend quyết định format.
     */
    Map<String, Object> mapConfig,

    SourceType sourceType,

    UUID sourceId
) {}
