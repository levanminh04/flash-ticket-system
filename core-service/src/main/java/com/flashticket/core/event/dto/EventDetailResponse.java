package com.flashticket.core.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Main DTO for Event Detail Response
 * 
 * Used by GET /api/events/{slug} endpoint
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EventDetailResponse {
    private UUID id;
    private String title;
    private String slug;
    private String description;
    private String shortDescription;
    private List<String> tags;
    
    private List<EventImageDTO> images;
    private List<CategoryDTO> categories;
    private VenueDTO venue;
    private ScheduleDTO schedule;
    private OrganizerDTO organizer;
    private List<TicketTypeDTO> ticketTypes;
    private ConfigDTO config;
    private StatisticsDTO statistics;
    
    private String status;
    private Boolean isFeatured;
    private Boolean isOnline;
    private String onlineEventUrl;
    
    private Instant createdAt;
    private Instant updatedAt;
}
