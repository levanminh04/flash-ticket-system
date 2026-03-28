package com.flashticket.core.event.controller;

import com.flashticket.core.event.dto.CreateEventRequest;
import com.flashticket.core.event.dto.EventDetailResponse;
import com.flashticket.core.event.dto.UpdateEventRequest;
import com.flashticket.core.event.service.OrganizerEventService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.UUID;

/**
 * CRUD Event phía Organizer.
 * Auth: role ORGANIZER (Keycloak JWT)
 */
@RestController
@RequestMapping("/api/organizer/events")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ORGANIZER')")
@Slf4j
public class OrganizerEventController {

    private final OrganizerEventService organizerEventService;

    /**
     * GET /api/organizer/events
     * Lấy danh sách event của Organizer hiện tại (paginated).
     */
    @GetMapping
    public ResponseEntity<Page<EventDetailResponse>> getMyEvents(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(defaultValue = "createdAt,desc") String sort
    ) {
        String organizerId = jwt.getSubject();
        log.info("GET /api/organizer/events - organizer={}", organizerId);

        Pageable pageable = buildPageable(page, size, sort);
        Page<EventDetailResponse> result = organizerEventService.getMyEvents(organizerId, pageable);
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/organizer/events/{eventId}
     * Lấy chi tiết 1 event (kể cả DRAFT — của chính Organizer này).
     */
    @GetMapping("/{eventId}")
    public ResponseEntity<EventDetailResponse> getMyEvent(
        @PathVariable UUID eventId,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String organizerId = jwt.getSubject();
        log.info("GET /api/organizer/events/{} - organizer={}", eventId, organizerId);

        EventDetailResponse response = organizerEventService.getMyEvent(eventId, organizerId);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/organizer/events
     * Tạo event mới. Status khởi tạo = DRAFT.
     * Slug tự động sinh từ title.
     */
    @PostMapping
    public ResponseEntity<EventDetailResponse> createEvent(
        @RequestBody @Valid CreateEventRequest req,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String organizerId = jwt.getSubject();
        String organizerName = jwt.getClaimAsString("name");
        log.info("POST /api/organizer/events - title='{}', organizer={}", req.title(), organizerId);

        EventDetailResponse response = organizerEventService.createEvent(req, organizerId, organizerName);
        return ResponseEntity
            .created(URI.create("/api/organizer/events/" + response.getId()))
            .body(response);
    }

    /**
     * PUT /api/organizer/events/{eventId}
     * Cập nhật thông tin event. Chỉ update field được truyền vào (khác null).
     */
    @PutMapping("/{eventId}")
    public ResponseEntity<EventDetailResponse> updateEvent(
        @PathVariable UUID eventId,
        @RequestBody @Valid UpdateEventRequest req,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String organizerId = jwt.getSubject();
        log.info("PUT /api/organizer/events/{} - organizer={}", eventId, organizerId);

        EventDetailResponse response = organizerEventService.updateEvent(eventId, req, organizerId);
        return ResponseEntity.ok(response);
    }

    /**
     * PATCH /api/organizer/events/{eventId}/publish
     * Chuyển DRAFT → PUBLISHED.
     * Điều kiện: phải có ít nhất 1 TicketType ACTIVE.
     */
    @PatchMapping("/{eventId}/publish")
    public ResponseEntity<EventDetailResponse> publishEvent(
        @PathVariable UUID eventId,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String organizerId = jwt.getSubject();
        log.info("PATCH /api/organizer/events/{}/publish - organizer={}", eventId, organizerId);

        EventDetailResponse response = organizerEventService.publishEvent(eventId, organizerId);
        return ResponseEntity.ok(response);
    }

    /**
     * PATCH /api/organizer/events/{eventId}/cancel
     * Hủy event. Cảnh báo nếu đã có vé bán.
     */
    @PatchMapping("/{eventId}/cancel")
    public ResponseEntity<EventDetailResponse> cancelEvent(
        @PathVariable UUID eventId,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String organizerId = jwt.getSubject();
        log.info("PATCH /api/organizer/events/{}/cancel - organizer={}", eventId, organizerId);

        EventDetailResponse response = organizerEventService.cancelEvent(eventId, organizerId);
        return ResponseEntity.ok(response);
    }

    /**
     * DELETE /api/organizer/events/{eventId}
     * Soft delete event. Bị chặn nếu có vé đã bán.
     */
    @DeleteMapping("/{eventId}")
    public ResponseEntity<Void> deleteEvent(
        @PathVariable UUID eventId,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String organizerId = jwt.getSubject();
        log.info("DELETE /api/organizer/events/{} - organizer={}", eventId, organizerId);

        organizerEventService.deleteEvent(eventId, organizerId);
        return ResponseEntity.noContent().build();
    }

    // ─── Private helper ─────────────────────────────────────

    private Pageable buildPageable(int page, int size, String sortParam) {
        page = Math.max(0, page);
        size = Math.min(Math.max(1, size), 50);
        String[] parts = sortParam.split(",");
        String field = parts[0];
        Sort.Direction dir = parts.length > 1 && parts[1].equalsIgnoreCase("asc")
            ? Sort.Direction.ASC : Sort.Direction.DESC;
        return PageRequest.of(page, size, Sort.by(dir, field));
    }
}
