package com.flashticket.core.event.controller;

import com.flashticket.core.event.dto.CreateTicketTypeRequest;
import com.flashticket.core.event.dto.TicketTypeOrganizerDTO;
import com.flashticket.core.event.service.TicketTypeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.UUID;

/**
 * TicketTypeController — CRUD TicketType phía Organizer.
 * Base path: /api/organizer/events/{eventId}/ticket-types
 */
@RestController
@RequestMapping("/api/organizer/events/{eventId}/ticket-types")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ORGANIZER')")
@Slf4j
public class TicketTypeController {

    private final TicketTypeService ticketTypeService;

    /**
     * GET /api/organizer/events/{eventId}/ticket-types
     * Lấy tất cả loại vé của event (kể cả hidden).
     */
    @GetMapping
    public ResponseEntity<List<TicketTypeOrganizerDTO>> getTicketTypes(
        @PathVariable UUID eventId,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String organizerId = jwt.getSubject();
        log.info("GET /api/organizer/events/{}/ticket-types - organizer={}", eventId, organizerId);
        return ResponseEntity.ok(ticketTypeService.getTicketTypes(eventId, organizerId));
    }

    /**
     * POST /api/organizer/events/{eventId}/ticket-types
     * Tạo loại vé mới cho event.
     */
    @PostMapping
    public ResponseEntity<TicketTypeOrganizerDTO> createTicketType(
        @PathVariable UUID eventId,
        @RequestBody @Valid CreateTicketTypeRequest req,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String organizerId = jwt.getSubject();
        log.info("POST /api/organizer/events/{}/ticket-types - name='{}', organizer={}",
            eventId, req.name(), organizerId);

        TicketTypeOrganizerDTO response = ticketTypeService.createTicketType(eventId, req, organizerId);
        return ResponseEntity
            .created(URI.create("/api/organizer/events/" + eventId + "/ticket-types/" + response.id()))
            .body(response);
    }

    /**
     * PUT /api/organizer/events/{eventId}/ticket-types/{typeId}
     * Cập nhật loại vé. Chặn giảm qtyTotal xuống dưới số đã bán.
     */
    @PutMapping("/{typeId}")
    public ResponseEntity<TicketTypeOrganizerDTO> updateTicketType(
        @PathVariable UUID eventId,
        @PathVariable UUID typeId,
        @RequestBody @Valid CreateTicketTypeRequest req,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String organizerId = jwt.getSubject();
        log.info("PUT /api/organizer/events/{}/ticket-types/{} - organizer={}", eventId, typeId, organizerId);

        TicketTypeOrganizerDTO response = ticketTypeService.updateTicketType(eventId, typeId, req, organizerId);
        return ResponseEntity.ok(response);
    }

    /**
     * DELETE /api/organizer/events/{eventId}/ticket-types/{typeId}
     * Soft delete loại vé. Chặn nếu đã có vé bán.
     */
    @DeleteMapping("/{typeId}")
    public ResponseEntity<Void> deleteTicketType(
        @PathVariable UUID eventId,
        @PathVariable UUID typeId,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String organizerId = jwt.getSubject();
        log.info("DELETE /api/organizer/events/{}/ticket-types/{} - organizer={}", eventId, typeId, organizerId);

        ticketTypeService.deleteTicketType(eventId, typeId, organizerId);
        return ResponseEntity.noContent().build();
    }
}
