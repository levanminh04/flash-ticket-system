package com.flashticket.core.event.service;

import com.flashticket.core.event.dto.EventResponse;
import com.flashticket.core.event.dto.EventSearchRequest;
import com.flashticket.core.event.entity.Event;
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


@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class EventService {
    
    private final EventRepository eventRepository;

    public Page<EventResponse> searchEvents(EventSearchRequest request, Pageable pageable) {
        log.debug("Searching events with filters: {}", request);
        
        Specification<Event> spec = Specification
            .where(EventSpecification.isPublished())                                 
            .and(EventSpecification.hasSearch(request.getSearch()))                    
            .and(EventSpecification.hasCity(request.getCity()))                        
            .and(EventSpecification.hasCategory(request.getCategory()))                 
            .and(EventSpecification.hasDateRange(request.getStartDate(), request.getEndDate())) 
            .and(EventSpecification.hasPriceRange(request.getMinPrice(), request.getMaxPrice()))
            .and(EventSpecification.isFeatured(request.getIsFeatured()));             
        
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
}
