package com.flashticket.core.event.service;

import com.flashticket.core.event.client.UserServiceClient;
import com.flashticket.core.event.dto.*;
import com.flashticket.core.event.dto.EventResponse;
import com.flashticket.core.event.dto.EventSearchRequest;
import com.flashticket.core.event.entity.*;
import com.flashticket.core.common.exception.ResourceNotFoundException;
import com.flashticket.core.event.repository.EventRepository;
import com.flashticket.core.event.specification.EventSpecification;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;


@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class EventService {
    
    private final EventRepository eventRepository;
    private final UserServiceClient userServiceClient;

    public Page<EventResponse> searchEvents(EventSearchRequest request, Pageable pageable) {
        log.debug("Searching events with filters: {}", request);

        Specification<Event> spec = Specification.allOf(
                EventSpecification.isPublished(),
                EventSpecification.hasSearch(request.getSearch()),
                EventSpecification.hasCity(request.getCity()),
                EventSpecification.hasCategory(request.getCategory()),
                EventSpecification.hasDateRange(request.getStartDate(), request.getEndDate()),
                EventSpecification.hasPriceRange(request.getMinPrice(), request.getMaxPrice()),
                EventSpecification.isFeatured(request.getIsFeatured())
        );
        
        Page<Event> events = eventRepository.findAll(spec, pageable);
        
        log.debug("Found {} events (page {}/{})", 
            events.getNumberOfElements(), 
            events.getNumber(), 
            events.getTotalPages());
        
        return events.map(EventResponse::from);
    }
    

    public List<EventResponse> getFeaturedEvents(int limit) {
        log.debug("Fetching top {} featured events", limit);
        
        EventSearchRequest request = EventSearchRequest.builder()
            .isFeatured(true)
            .build();
        
        Pageable pageable = Pageable.ofSize(limit);
        
        Page<EventResponse> page = searchEvents(request, pageable);
        
        log.debug("Found {} featured events", page.getNumberOfElements());
        return page.getContent();
    }
    
    /**
     * Get event detail by ID or slug
     */
    public EventDetailResponse getEventByIdOrSlug(String idOrSlug) {
        log.info("Fetching event detail for: {}", idOrSlug);
        
        Event event = findEventByIdOrSlug(idOrSlug);
        if (event.getStatus() != Event.EventStatus.PUBLISHED) {
            throw new ResourceNotFoundException("Event not found: " + idOrSlug);
        }
        
        // 2. Map to DTO
        EventDetailResponse response = mapToEventDetailResponse(event);
        
        // Enrich organizer data from User Service
        enrichOrganizerData(response, event);
        
        log.info("Successfully fetched event: {} (ID: {})", event.getTitle(), event.getId());
        return response;
    }
    
    /**
     * Find event by ID or slug
     * 
     * LOGIC:
     * - Try parse as UUID → findById
     * - If not UUID → findBySlug
     */
    private Event findEventByIdOrSlug(String idOrSlug) {
        if (isValidUUID(idOrSlug)) {
            UUID uuid = UUID.fromString(idOrSlug);
            return eventRepository.findByIdAndIsDeletedFalse(uuid)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found with ID: " + idOrSlug));
        } else {
            return eventRepository.findBySlugAndIsDeletedFalse(idOrSlug)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found with slug: " + idOrSlug));
        }
    }
    
    /**
     * Check if string is valid UUID
     */
    private boolean isValidUUID(String str) {
        try {
            UUID.fromString(str);
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
    
    /**
     * Map Event entity to EventDetailResponse DTO
     * 
     * PERFORMANCE NOTE:
     * - All collections (images, ticketTypes, categories) are already loaded by @EntityGraph
     * - No additional queries will be triggered
     */
    private EventDetailResponse mapToEventDetailResponse(Event event) {
        return EventDetailResponse.builder()
            .id(event.getId())
            .title(event.getTitle())
            .slug(event.getSlug())
            .description(event.getDescription())
            .shortDescription(event.getShortDescription())
            .tags(event.getTags()) // JSONB - hypersistence
            /**
             * jsonb column:                  JsonType.nullSafeGet()       List<String> tags
             * ["rock","music","live"]  ───►  (deserialize JSON)     ───► = ["rock","music","live"]
             * */

            .images(mapImages(event.getImages()))
            .categories(mapCategories(event.getCategories()))
            .venue(mapVenue(event.getVenue()))
            .schedule(mapSchedule(event))
            .ticketTypes(mapTicketTypes(event.getTicketTypes()))
            .config(mapConfig(event))
            .statistics(mapStatistics(event))
            
            // Organizer (cached data from Event entity - will be enriched later)
            .organizer(OrganizerDTO.builder()
                .id(event.getOrganizerId())
                .name(event.getOrganizerName())
                .logoUrl(event.getOrganizerLogoUrl())
                .build())
            
            .status(event.getStatus().name())
            .isFeatured(event.getIsFeatured())
            .isOnline(event.getIsOnline())
            .onlineEventUrl(event.getOnlineEventUrl())
            .createdAt(event.getCreatedAt())
            .updatedAt(event.getUpdatedAt())
            .build();
    }
    
    /**
     * Enrich organizer data from User Service
     * 
     * STRATEGY:
     * - Use cached data from Event entity first (already set in mapToEventDetailResponse)
     * - Call User Service to get full organizer profile
     * - If User Service fails, keep cached data (resilient fallback)
     */
    private void enrichOrganizerData(EventDetailResponse response, Event event) {
        try {
            // Call User Service to get full organizer profile
            OrganizerDTO fullProfile = userServiceClient.getOrganizerProfile(event.getOrganizerId());
            
            if (fullProfile != null) {
                response.setOrganizer(fullProfile);
                log.debug("Enriched organizer data from User Service for: {}", fullProfile.getName());

                // Self-healing: if logoUrl is stale, update denormalized data asynchronously
                if (fullProfile.getLogoUrl() != null && !fullProfile.getLogoUrl().equals(event.getOrganizerLogoUrl())) {
                    log.info("Self-healing: updating stale organizerLogoUrl for organizer {}", event.getOrganizerId());
                    java.util.concurrent.CompletableFuture.runAsync(() -> {
                        try {
                            eventRepository.updateOrganizerLogoUrlByOrganizerId(event.getOrganizerId(), fullProfile.getLogoUrl());
                        } catch (Exception e) {
                            log.error("Failed to async update stale organizer logo for organizer {}", event.getOrganizerId(), e);
                        }
                    });
                }
            } else {
                log.debug("User Service returned null, using cached organizer data");
            }
        } catch (Exception e) {
            log.warn("Failed to fetch organizer profile from User Service for ID: {}. Using cached data. Error: {}", 
                event.getOrganizerId(), e.getMessage());
            // Keep cached data from Event entity (already set in mapToEventDetailResponse)
        }
    }
    
    // ========== Mapping Helper Methods ==========
    
    private List<EventImageDTO> mapImages(List<EventImage> images) {
        if (images == null) return List.of();
        
        return images.stream()
            .filter(img -> !img.getIsDeleted())
            .map(img -> EventImageDTO.builder()
                .id(img.getId())
                .url(img.getImageUrl())
                .type(img.getImageType().name())
                .isPrimary(img.getIsPrimary())
                .displayOrder(img.getDisplayOrder())
                .build())
            .sorted((a, b) -> {
                // Primary image first, then by display order
                if (a.getIsPrimary() && !b.getIsPrimary()) return -1;
                if (!a.getIsPrimary() && b.getIsPrimary()) return 1;
                return a.getDisplayOrder().compareTo(b.getDisplayOrder());
            })
            .collect(Collectors.toList());
    }
    
    private List<CategoryDTO> mapCategories(List<Category> categories) {
        if (categories == null) return List.of();
        
        return categories.stream()
            .filter(cat -> !cat.getIsDeleted() && cat.getIsActive())
            .map(cat -> CategoryDTO.builder()
                .id(cat.getId())
                .name(cat.getName())
                .slug(cat.getSlug())
                .isPrimary(null) // Junction table event_categories doesn't have isPrimary field
                .build())
            .collect(Collectors.toList());
    }
    
    private VenueDTO mapVenue(Venue venue) {
        if (venue == null) return null;
        
        return VenueDTO.builder()
            .id(venue.getId())
            .name(venue.getName())
            .slug(venue.getSlug())
            .address(venue.getAddress())
            .city(venue.getCity())
            .latitude(venue.getLatitude() != null ? venue.getLatitude().doubleValue() : null)
            .longitude(venue.getLongitude() != null ? venue.getLongitude().doubleValue() : null)
            .totalCapacity(venue.getTotalCapacity())
            .facilities(venue.getFacilities()) // JSONB list
            .build();
    }
    
    private ScheduleDTO mapSchedule(Event event) {
        return ScheduleDTO.builder()
            .startDatetime(event.getStartDatetime())
            .endDatetime(event.getEndDatetime())
            .timezone(event.getTimezone())
            .saleStartDatetime(event.getSaleStartDatetime())
            .saleEndDatetime(event.getSaleEndDatetime())
            .build();
    }
    
    private List<TicketTypeDTO> mapTicketTypes(List<TicketType> ticketTypes) {
        if (ticketTypes == null) return List.of();
        
        return ticketTypes.stream()
            .filter(tt -> !tt.getIsDeleted()
                && tt.getIsVisible()
                && tt.getStatus() == TicketType.TicketStatus.ACTIVE
                && tt.getQuantityAvailable() != null
                && tt.getQuantityAvailable() > 0)
            .map(tt -> TicketTypeDTO.builder()
                .id(tt.getId())
                .name(tt.getName())
                .description(tt.getDescription())
                .price(tt.getPrice())
                .originalPrice(tt.getOriginalPrice())
                .currency(tt.getCurrency())
                .quantityTotal(tt.getQuantityTotal())
                .quantityAvailable(tt.getQuantityAvailable())
                .eventSectorId(tt.getEventSectorId())
                .inventoryMode(tt.getInventoryMode() != null ? tt.getInventoryMode().name() : null)
                .accessScope(tt.getAccessScope() != null ? tt.getAccessScope().name() : null)
                .maxPerOrder(tt.getMaxPerOrder())
                .saleStartDatetime(tt.getSaleStartDatetime())
                .saleEndDatetime(tt.getSaleEndDatetime())
                .seatSelectionEnabled(tt.getSeatSelectionEnabled()) // Có cho chọn ghế không
                .status(tt.getStatus().name())
                .colorCode(tt.getColorCode())
                .displayOrder(tt.getDisplayOrder())
                .build())
            .sorted((a, b) -> a.getDisplayOrder().compareTo(b.getDisplayOrder()))
            .collect(Collectors.toList());
    }
    
    private ConfigDTO mapConfig(Event event) {
        return ConfigDTO.builder()
            .minTicketsPerOrder(event.getMinTicketsPerOrder())
            .maxTicketsPerOrder(event.getMaxTicketsPerOrder())
            .visibility(event.getVisibility().name())
            .build();
    }
    
    private StatisticsDTO mapStatistics(Event event) {
        return StatisticsDTO.builder()
            .viewCount(event.getViewCount())
            .ticketsSold(event.getTicketsSold())
            .totalCapacity(event.getTotalCapacity())
            .build();
    }
}
