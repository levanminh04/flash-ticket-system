package com.flashticket.core.event.controller;

import com.flashticket.core.event.dto.VenueResponse;
import com.flashticket.core.event.service.VenueService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Controller cho Venue
 */
@RestController
@RequestMapping("/api/venues")
@RequiredArgsConstructor
@Slf4j
public class VenueController {
    
    private final VenueService venueService;
    
    /**
     * GET /api/venues
     * Lấy danh sách địa điểm tổ chức (Public)
     */
    @GetMapping
    public ResponseEntity<List<VenueResponse>> getVenues() {
        log.info("GET /api/venues - Fetching active venues");
        return ResponseEntity.ok(venueService.getAllActiveVenues());
    }
}
