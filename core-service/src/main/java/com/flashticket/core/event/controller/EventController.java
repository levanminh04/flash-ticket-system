package com.flashticket.core.event.controller;

import com.flashticket.core.event.dto.EventDetailResponse;
import com.flashticket.core.event.dto.EventResponse;
import com.flashticket.core.event.dto.EventSearchRequest;
import com.flashticket.core.event.service.EventService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;


@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
@Slf4j
public class EventController {
    
    private final EventService eventService;
    
    /**
     * Query Parameters:
     * - search: Tìm theo title
     * - city: Filter theo thành phố
     * - category: Filter theo category slug
     * - startDate: Filter events >= startDate (yyyy-MM-dd)
     * - endDate: Filter events <= endDate (yyyy-MM-dd)
     * - minPrice: Filter events có vé >= minPrice
     * - maxPrice: Filter events có vé <= maxPrice
     * - isFeatured: Filter theo featured status (true/false)
     * - page: Page number (default 0)
     * - size: Page size (default 12)
     * - sort: Sort field và direction (default "startDatetime,asc")
     */
    @GetMapping
    public ResponseEntity<Page<EventResponse>> searchEvents(
        EventSearchRequest searchRequest,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "12") int size,
        @RequestParam(defaultValue = "startDatetime,asc") String sort
    ) {
        log.info("GET /api/events - Searching events with filters: {}, page: {}, size: {}, sort: {}", 
            searchRequest, page, size, sort);
        
        Pageable pageable = createPageable(page, size, sort);
        
        Page<EventResponse> result = eventService.searchEvents(searchRequest, pageable);
        
        log.info("GET /api/events - Returned {} events (page {}/{})", 
            result.getNumberOfElements(), 
            result.getNumber() + 1, 
            result.getTotalPages());
        
        return ResponseEntity.ok(result);
    }
    
    /**
     * GET /api/events/featured
     * Lấy danh sách featured events (for homepage)
     */
    @GetMapping("/featured")
    public ResponseEntity<List<EventResponse>> getFeaturedEvents(
        @RequestParam(defaultValue = "6") int limit
    ) {
        log.info("GET /api/events/featured - Fetching top {} featured events", limit);
        
        List<EventResponse> events = eventService.getFeaturedEvents(limit);
        
        log.info("GET /api/events/featured - Returned {} events", events.size());
        return ResponseEntity.ok(events);
    }
    
    /**
     * Get event detail by ID or slug
     * ví dụ:
     * - GET /api/events/rock-storm-2026
     * - GET /api/events/a1b2c3d4-e5f6-7890-abcd-ef1234567890
     * @param eventIdOrSlug UUID or slug
     */
    @GetMapping("/{eventIdOrSlug}")
    public ResponseEntity<EventDetailResponse> getEventDetail(
        @PathVariable String eventIdOrSlug
    ) {
        log.info("GET /api/events/{} - Fetching event detail", eventIdOrSlug);
        
        EventDetailResponse event = eventService.getEventByIdOrSlug(eventIdOrSlug);
        
        log.info("GET /api/events/{} - Successfully returned event: {}", 
            eventIdOrSlug, event.getTitle());
        
        return ResponseEntity.ok(event);
    }
    
    /**
     * Sort format: "field,direction"
     * ví dụ:
     * - "startDatetime,asc"
     * - "createdAt,desc"
     * - "title,asc"
     */
    private Pageable createPageable(int page, int size, String sortParam) {

        if (page < 0) page = 0;
        if (size < 1) size = 12;
        if (size > 100) size = 100; 
        
        String[] sortParams = sortParam.split(",");
        String sortField = sortParams[0];
        Sort.Direction direction = sortParams.length > 1 && sortParams[1].equalsIgnoreCase("desc")
            ? Sort.Direction.DESC
            : Sort.Direction.ASC;
        // Sort tương đương ORDER BY column1 ASC, column2 DESC
        return PageRequest.of(page, size, Sort.by(direction, sortField));
    }
}
