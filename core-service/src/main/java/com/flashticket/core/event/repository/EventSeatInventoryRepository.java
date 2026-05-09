package com.flashticket.core.event.repository;

import com.flashticket.core.event.entity.EventSeatInventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EventSeatInventoryRepository extends JpaRepository<EventSeatInventory, UUID> {
    
    // Tìm toàn bộ inventory của 1 event để map vào Seat Status
    List<EventSeatInventory> findByEventId(UUID eventId);

    @Query("""
        SELECT inventory
        FROM EventSeatInventory inventory
        WHERE inventory.eventId = :eventId
          AND inventory.eventSeat.id = :seatId
        """)
    Optional<EventSeatInventory> findByEventIdAndSeatId(
        @Param("eventId") UUID eventId,
        @Param("seatId") UUID seatId
    );

    List<EventSeatInventory> findByOrderId(UUID orderId);
}
