package com.flashticket.core.event.dto;

import com.flashticket.core.event.entity.EventLayout;
import com.flashticket.core.event.entity.EventLayout.SourceType;
import lombok.Builder;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Builder
public record EventLayoutResponse(
    UUID id,
    UUID eventId,
    String name,
    String backgroundImageUrl,
    String backgroundPublicId,
    Integer backgroundWidth,
    Integer backgroundHeight,
    Map<String, Object> mapConfig,
    SourceType sourceType,
    UUID sourceId,
    Instant createdAt,
    Instant updatedAt
) {
    public static EventLayoutResponse from(EventLayout entity) {
        return EventLayoutResponse.builder()
            .id(entity.getId())
            .eventId(entity.getEvent().getId())
            .name(entity.getName())
            .backgroundImageUrl(entity.getBackgroundImageUrl())
            .backgroundPublicId(entity.getBackgroundPublicId())
            .backgroundWidth(entity.getBackgroundWidth())
            .backgroundHeight(entity.getBackgroundHeight())
            .mapConfig(entity.getMapConfig())
            .sourceType(entity.getSourceType())
            .sourceId(entity.getSourceId())
            .createdAt(entity.getCreatedAt())
            .updatedAt(entity.getUpdatedAt())
            .build();
    }
}
