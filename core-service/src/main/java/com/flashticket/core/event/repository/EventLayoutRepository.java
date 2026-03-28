package com.flashticket.core.event.repository;

import com.flashticket.core.event.entity.EventLayout;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface EventLayoutRepository extends JpaRepository<EventLayout, UUID> {

    Optional<EventLayout> findByEventId(UUID eventId);

    boolean existsByEventId(UUID eventId);
}
