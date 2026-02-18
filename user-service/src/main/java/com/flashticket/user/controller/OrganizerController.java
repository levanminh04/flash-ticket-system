package com.flashticket.user.controller;

import com.flashticket.user.dto.OrganizerDTO;
import com.flashticket.user.service.OrganizerService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;


@RestController
@RequestMapping("/api/organizers")
@RequiredArgsConstructor
@Slf4j
public class OrganizerController {
    
    private final OrganizerService organizerService;
    

    @GetMapping("/{organizerId}")
    public ResponseEntity<OrganizerDTO> getOrganizerById(@PathVariable String organizerId) {
        log.info("GET /api/organizers/{} - Fetching organizer profile", organizerId);
        
        OrganizerDTO organizer = organizerService.getOrganizerById(organizerId);
        
        log.info("GET /api/organizers/{} - Successfully returned organizer: {}", 
            organizerId, organizer.getName());
        
        return ResponseEntity.ok(organizer);
    }
    
    /**
     * Get organizer profile by user ID
     */
    @GetMapping("/by-user/{userId}")
    public ResponseEntity<OrganizerDTO> getOrganizerByUserId(@PathVariable String userId) {
        log.info("GET /api/organizers/by-user/{} - Fetching organizer profile", userId);
        
        OrganizerDTO organizer = organizerService.getOrganizerByUserId(userId);
        
        log.info("GET /api/organizers/by-user/{} - Successfully returned organizer: {}", 
            userId, organizer.getName());
        
        return ResponseEntity.ok(organizer);
    }
}
