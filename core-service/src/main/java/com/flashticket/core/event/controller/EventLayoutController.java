package com.flashticket.core.event.controller;

import com.flashticket.core.event.dto.EventLayoutRequest;
import com.flashticket.core.event.dto.EventLayoutResponse;
import com.flashticket.core.event.service.EventLayoutService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.UUID;

/**
 * EventLayoutController — CRUD layout ghế cho Organizer.
 * Base path: /api/organizer/events/{eventId}/layout (singular — 1 event : 1 layout)
 *
 * Workflow điển hình:
 * 1. Upload ảnh nền: POST /api/organizer/events/{id}/images?imageType=SEAT_MAP → lấy URL
 * 2. Tạo layout:     POST /api/organizer/events/{id}/layout (truyền URL vào backgroundImageUrl)
 * 3. Frontend dùng GET để load layout vào Konva.js Designer
 */
@RestController
@RequestMapping("/api/organizer/events/{eventId}/layout")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ORGANIZER')")
@Slf4j
public class EventLayoutController {

    private final EventLayoutService eventLayoutService;

    /**
     * GET /api/organizer/events/{eventId}/layout
     * Lấy layout của event. 404 nếu chưa tạo.
     */
    @GetMapping
    public ResponseEntity<EventLayoutResponse> getLayout(
        @PathVariable UUID eventId,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String organizerId = jwt.getSubject();
        log.info("GET /api/organizer/events/{}/layout - organizer={}", eventId, organizerId);
        return ResponseEntity.ok(eventLayoutService.getLayout(eventId, organizerId));
    }

    /**
     * POST /api/organizer/events/{eventId}/layout
     * Tạo layout mới. 409 Conflict nếu đã tồn tại.
     */
    @PostMapping
    public ResponseEntity<EventLayoutResponse> createLayout(
        @PathVariable UUID eventId,
        @RequestBody EventLayoutRequest req,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String organizerId = jwt.getSubject();
        log.info("POST /api/organizer/events/{}/layout - organizer={}", eventId, organizerId);

        EventLayoutResponse response = eventLayoutService.createLayout(eventId, req, organizerId);
        return ResponseEntity
            .created(URI.create("/api/organizer/events/" + eventId + "/layout"))
            .body(response);
    }

    /**
     * PUT /api/organizer/events/{eventId}/layout
     * Cập nhật layout. 404 nếu chưa tồn tại. Partial update — chỉ update field khác null.
     */
    @PutMapping
    public ResponseEntity<EventLayoutResponse> updateLayout(
        @PathVariable UUID eventId,
        @RequestBody EventLayoutRequest req,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String organizerId = jwt.getSubject();
        log.info("PUT /api/organizer/events/{}/layout - organizer={}", eventId, organizerId);

        EventLayoutResponse response = eventLayoutService.updateLayout(eventId, req, organizerId);
        return ResponseEntity.ok(response);
    }

    /**
     * DELETE /api/organizer/events/{eventId}/layout
     * Xóa toàn bộ layout (CASCADE xóa sectors + seats trong DB).
     * Dùng khi muốn thiết kế lại sơ đồ từ đầu.
     */
    @DeleteMapping
    public ResponseEntity<Void> deleteLayout(
        @PathVariable UUID eventId,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String organizerId = jwt.getSubject();
        log.info("DELETE /api/organizer/events/{}/layout - organizer={}", eventId, organizerId);

        eventLayoutService.deleteLayout(eventId, organizerId);
        return ResponseEntity.noContent().build();
    }
}
