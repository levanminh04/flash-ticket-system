package com.flashticket.core.event.repository;

import com.flashticket.core.event.entity.Event;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Event Repository
 * 
 * Extends JpaSpecificationExecutor để support dynamic queries với Specification
 */
@Repository
public interface EventRepository extends JpaRepository<Event, UUID>, 
                                         JpaSpecificationExecutor<Event> {
    
    /**
     * Override findAll để eager load venue (prevent N+1 queries)
     * Khi load 12 events → 1 query thay vì 13 queries
     * Override ở đây có tác dụng để 
     */
    @Override
    @EntityGraph(attributePaths = {"venue"})
    Page<Event> findAll(Specification<Event> spec, Pageable pageable);
    
    /**
     * Find event by ID with eager loading
     * 
     * PERFORMANCE OPTIMIZATION:
     * - @EntityGraph prevents N+1 queries
     * - Single query with LEFT JOIN FETCH
     * - Loads: venue, images, ticketTypes, categories in 1 query
     */
    @EntityGraph(attributePaths = {"venue", "images", "ticketTypes", "categories"})
    Optional<Event> findByIdAndIsDeletedFalse(UUID id);
    
    /**
     * Find event by slug with eager loading
     * 
     * PERFORMANCE OPTIMIZATION:
     * - @EntityGraph prevents N+1 queries
     * - Single query with LEFT JOIN FETCH
     * - Loads: venue, images, ticketTypes, categories in 1 query
     */
    @EntityGraph(attributePaths = {"venue", "images", "ticketTypes", "categories"})
    Optional<Event> findBySlugAndIsDeletedFalse(String slug);
}
