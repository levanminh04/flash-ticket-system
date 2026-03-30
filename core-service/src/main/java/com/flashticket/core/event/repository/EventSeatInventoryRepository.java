package com.flashticket.core.event.repository;

import com.flashticket.core.event.entity.EventSeatInventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface EventSeatInventoryRepository extends JpaRepository<EventSeatInventory, UUID> {
    
    // Tìm toàn bộ inventory của 1 event để map vào Seat Status
    List<EventSeatInventory> findByEventId(UUID eventId);
}
