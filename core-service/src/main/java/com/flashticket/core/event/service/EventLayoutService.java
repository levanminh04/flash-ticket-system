package com.flashticket.core.event.service;

import com.flashticket.core.common.exception.InvalidRequestException;
import com.flashticket.core.common.exception.ResourceNotFoundException;
import com.flashticket.core.event.dto.EventLayoutRequest;
import com.flashticket.core.event.dto.EventLayoutResponse;
import com.flashticket.core.event.entity.Event;
import com.flashticket.core.event.entity.EventLayout;
import com.flashticket.core.event.repository.EventLayoutRepository;
import com.flashticket.core.event.repository.EventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * EventLayoutService — Xử lý CRUD cho event_layouts.
 * 1 Event = 1 Layout (UNIQUE constraint ở DB).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EventLayoutService {

    private final EventLayoutRepository eventLayoutRepository;
    private final EventRepository eventRepository;

    @Transactional(readOnly = true)
    public EventLayoutResponse getLayout(UUID eventId, String organizerId) {
        findOwnedEvent(eventId, organizerId);
        return eventLayoutRepository.findByEventId(eventId)
            .map(EventLayoutResponse::from)
            .orElseThrow(() -> new ResourceNotFoundException(
                "Sự kiện chưa có sơ đồ ghế. Tạo layout trước qua POST /api/organizer/events/" + eventId + "/layout"));
    }

    @Transactional
    public EventLayoutResponse createLayout(UUID eventId, EventLayoutRequest req, String organizerId) {
        Event event = findOwnedEvent(eventId, organizerId);

        if (eventLayoutRepository.existsByEventId(eventId)) {
            throw new InvalidRequestException(
                "Sự kiện đã có layout. Dùng PUT để cập nhật hoặc DELETE để xóa rồi tạo mới");
        }

        EventLayout layout = EventLayout.builder()
            .event(event)
            .name(req.name())
            .backgroundImageUrl(req.backgroundImageUrl())
            .backgroundPublicId(req.backgroundPublicId())
            .backgroundWidth(req.backgroundWidth())
            .backgroundHeight(req.backgroundHeight())
            .mapConfig(req.mapConfig())
            .sourceType(req.sourceType() != null ? req.sourceType() : EventLayout.SourceType.CUSTOM)
            .sourceId(req.sourceId())
            .build();

        layout = eventLayoutRepository.save(layout);
        log.info("Created layout {} for event {}", layout.getId(), eventId);
        return EventLayoutResponse.from(layout);
    }

    @Transactional
    public EventLayoutResponse updateLayout(UUID eventId, EventLayoutRequest req, String organizerId) {
        findOwnedEvent(eventId, organizerId);

        EventLayout layout = eventLayoutRepository.findByEventId(eventId)
            .orElseThrow(() -> new ResourceNotFoundException(
                "Chưa có layout để cập nhật. Tạo trước qua POST /api/organizer/events/" + eventId + "/layout"));

        // Partial update
        if (req.name() != null) layout.setName(req.name());
        if (req.backgroundImageUrl() != null) layout.setBackgroundImageUrl(req.backgroundImageUrl());
        if (req.backgroundPublicId() != null) layout.setBackgroundPublicId(req.backgroundPublicId());
        if (req.backgroundWidth() != null) layout.setBackgroundWidth(req.backgroundWidth());
        if (req.backgroundHeight() != null) layout.setBackgroundHeight(req.backgroundHeight());
        if (req.mapConfig() != null) layout.setMapConfig(req.mapConfig());
        if (req.sourceType() != null) layout.setSourceType(req.sourceType());
        if (req.sourceId() != null) layout.setSourceId(req.sourceId());

        layout = eventLayoutRepository.save(layout);
        log.info("Updated layout {} for event {}", layout.getId(), eventId);
        return EventLayoutResponse.from(layout);
    }

    @Transactional
    public void deleteLayout(UUID eventId, String organizerId) {
        findOwnedEvent(eventId, organizerId);

        EventLayout layout = eventLayoutRepository.findByEventId(eventId)
            .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy layout cho event: " + eventId));

        eventLayoutRepository.delete(layout);
        log.info("Deleted layout for event {}", eventId);
    }

    private Event findOwnedEvent(UUID eventId, String organizerId) {
        return eventRepository.findByIdAndOrganizerIdAndIsDeletedFalse(eventId, organizerId)
            .orElseThrow(() -> new ResourceNotFoundException("Sự kiện không tồn tại: " + eventId));
    }
}
