package com.flashticket.core.event.repository;

import com.flashticket.core.event.entity.EventLayout;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface EventLayoutRepository extends JpaRepository<EventLayout, UUID> {

    Optional<EventLayout> findByEventId(UUID eventId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT l FROM EventLayout l WHERE l.event.id = :eventId")
    Optional<EventLayout> findByEventIdForUpdate(@Param("eventId") UUID eventId);

    boolean existsByEventId(UUID eventId);
}
