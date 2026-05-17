package com.flashticket.core.event.controller;

import com.flashticket.core.event.dto.SeatMapPublishRequest;
import com.flashticket.core.event.dto.SeatMapResponse;
import com.flashticket.core.event.service.SeatMapSyncService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * Quản lý (Seat, Sector) của sơ đồ ghế.
 */
@RestController
@RequestMapping("/api/organizer/events/{eventId}/seat-map")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ORGANIZER')")
@Slf4j
public class EventSeatMapController {

    private final SeatMapSyncService seatMapSyncService;

    /**
     * GET /api/organizer/events/{eventId}/seat-map
     * Lấy toán bộ dữ liệu Layout, Sector, Seat và gán inventoryStatus cho từng ghế.
     */
    @GetMapping
    public ResponseEntity<SeatMapResponse> getSeatMap(
        @PathVariable UUID eventId,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String organizerId = jwt.getSubject();
        log.info("GET /api/organizer/events/{}/seat-map by organizer {}", eventId, organizerId);

        SeatMapResponse response = seatMapSyncService.getSeatMap(eventId, organizerId);
        
        return ResponseEntity.ok(response);
    }

    @PostMapping("/publish")
    public ResponseEntity<SeatMapResponse> publishSeatMap(
        @PathVariable UUID eventId,
        @RequestBody @Valid SeatMapPublishRequest payload,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String organizerId = jwt.getSubject();
        log.info("POST /api/organizer/events/{}/seat-map/publish by organizer {}", eventId, organizerId);

        SeatMapResponse response = seatMapSyncService.publishSeatMap(eventId, payload, organizerId);
        return ResponseEntity.ok(response);
    }
}
