package com.flashticket.core.event.repository;

import com.flashticket.core.event.entity.EventSeat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface EventSeatRepository extends JpaRepository<EventSeat, UUID> {
    List<EventSeat> findBySectorIdAndIsActiveTrue(UUID sectorId);
}
