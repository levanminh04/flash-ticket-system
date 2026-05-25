package com.flashticket.core.event.repository;

import com.flashticket.core.event.entity.EventSeatInventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Repository
public interface EventSeatInventoryRepository extends JpaRepository<EventSeatInventory, UUID> {

    @Query("SELECT i FROM EventSeatInventory i JOIN FETCH i.eventSeat WHERE i.eventId = :eventId")
    List<EventSeatInventory> findByEventId(@Param("eventId") UUID eventId);

    @Query("""
           SELECT i FROM EventSeatInventory i
           JOIN FETCH i.eventSeat s
           JOIN FETCH s.sector sec
           JOIN FETCH sec.layout l
           WHERE i.eventId = :eventId
             AND s.id IN :seatIds
           """)
    List<EventSeatInventory> findByEventIdAndSeatIdsForValidation(
        @Param("eventId") UUID eventId,
        @Param("seatIds") Collection<UUID> seatIds
    );

    @Query("""
           SELECT i FROM EventSeatInventory i
           WHERE i.eventId = :eventId
             AND i.eventSeat.id = :seatId
           """)
    Optional<EventSeatInventory> findByEventIdAndEventSeatId(
        @Param("eventId") UUID eventId,
        @Param("seatId") UUID seatId
    );

    @Query("""
           SELECT i FROM EventSeatInventory i
           JOIN FETCH i.eventSeat
           WHERE i.orderId = :orderId
           """)
    List<EventSeatInventory> findAllByOrderId(@Param("orderId") UUID orderId);

    @Query("""
           SELECT COUNT(i) FROM EventSeatInventory i
           WHERE i.eventSeat.id IN :seatIds
             AND i.status IN :statuses
           """)
    long countByEventSeatIdInAndStatusIn(
        @Param("seatIds") Collection<UUID> seatIds,
        @Param("statuses") Collection<String> statuses
    );

    @Query("""
           SELECT i.eventSeat.id FROM EventSeatInventory i
           WHERE i.eventSeat.id IN :seatIds
             AND i.status IN :statuses
           """)
    Set<UUID> findEventSeatIdsByStatusIn(
        @Param("seatIds") Collection<UUID> seatIds,
        @Param("statuses") Collection<String> statuses
    );

    @Query(value = """
        SELECT COUNT(*)
        FROM event_schema.event_seat_inventory i
        JOIN event_schema.event_seats s ON s.id = i.event_seat_id
        WHERE i.event_id = :eventId
          AND s.sector_id = :sectorId
          AND i.status IN (:statuses)
        """, nativeQuery = true)
    long countByEventIdAndSectorIdAndStatusIn(
        @Param("eventId") UUID eventId,
        @Param("sectorId") UUID sectorId,
        @Param("statuses") Collection<String> statuses
    );


    // Trong case seat map này, dữ liệu ghế đã nằm trong DB ở bảng event_seats, nên dùng INSERT ... SELECT hợp lý hơn PreparedStatement batch (dùng khi rows được truyền từ FE xuống).
    // lệnh SELECT trả về đống rows  cho lenh insert dùng chung trong 1 excution plan
    @Modifying
    @Query(value = """
        INSERT INTO event_schema.event_seat_inventory
            (id, event_id, event_seat_id, ticket_type_id, status, created_at, updated_at)
        SELECT uuid_generate_v4(), :eventId, s.id, s.ticket_type_id, 'AVAILABLE', NOW(), NOW()
        FROM event_schema.event_seats s
        JOIN event_schema.event_sectors sec ON sec.id = s.sector_id
        JOIN event_schema.event_layouts l ON l.id = sec.layout_id
        WHERE s.sector_id = :sectorId
          AND l.event_id = :eventId
          AND s.is_active = true
          AND s.ticket_type_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM event_schema.event_seat_inventory i
              WHERE i.event_id = :eventId
                AND i.event_seat_id = s.id
          )
        """, nativeQuery = true)
    int bulkInsertInventoryForSector(
        @Param("eventId") UUID eventId,
        @Param("sectorId") UUID sectorId
    );

    @Modifying
    @Query(value = """
        UPDATE event_schema.event_seat_inventory i
        SET ticket_type_id = s.ticket_type_id,
            updated_at = NOW()
        FROM event_schema.event_seats s
        JOIN event_schema.event_sectors sec ON sec.id = s.sector_id
        JOIN event_schema.event_layouts l ON l.id = sec.layout_id
        WHERE i.event_seat_id = s.id
          AND i.event_id = :eventId
          AND s.sector_id = :sectorId
          AND l.event_id = :eventId
          AND s.ticket_type_id IS NOT NULL
          AND i.status IN ('AVAILABLE', 'BLOCKED')
        """, nativeQuery = true)
    int syncAvailableTicketTypeFromSeatsForSector(
        @Param("eventId") UUID eventId,
        @Param("sectorId") UUID sectorId
    );

    @Modifying
    @Query(value = """
        UPDATE event_schema.event_seat_inventory i
        SET ticket_type_id = NULL,
            updated_at = NOW()
        FROM event_schema.event_seats s
        JOIN event_schema.event_sectors sec ON sec.id = s.sector_id
        JOIN event_schema.event_layouts l ON l.id = sec.layout_id
        WHERE i.event_seat_id = s.id
          AND i.event_id = :eventId
          AND s.sector_id = :sectorId
          AND l.event_id = :eventId
          AND i.status IN ('AVAILABLE', 'BLOCKED')
          AND (s.is_active = false OR s.ticket_type_id IS NULL)
        """, nativeQuery = true)
    int clearInactiveOrUnassignedTicketTypeSnapshotsForSector(
        @Param("eventId") UUID eventId,
        @Param("sectorId") UUID sectorId
    );

    @Query(value = """
        SELECT COUNT(*)
        FROM event_schema.event_seat_inventory i
        WHERE i.ticket_type_id = :ticketTypeId
          AND i.status = :status
        """, nativeQuery = true)
    long countByTicketTypeIdAndStatus(
        @Param("ticketTypeId") UUID ticketTypeId,
        @Param("status") String status
    );

    @Modifying
    @Query(value = """
        UPDATE event_schema.event_seat_inventory i
        SET status = 'RESERVED',
            order_id = :orderId,
            updated_at = NOW()
        FROM event_schema.event_seats s
        WHERE i.event_seat_id = :seatId
          AND i.event_id = :eventId
          AND i.ticket_type_id = :ticketTypeId
          AND i.status = 'AVAILABLE'
          AND s.id = i.event_seat_id
          AND s.is_active = true
          AND s.ticket_type_id = :ticketTypeId
        """, nativeQuery = true)
    int reserveSeatIfAvailable(
        @Param("seatId") UUID seatId,
        @Param("eventId") UUID eventId,
        @Param("ticketTypeId") UUID ticketTypeId,
        @Param("orderId") UUID orderId
    );

    @Modifying
    @Query(value = """
        UPDATE event_schema.event_seat_inventory
        SET status = 'AVAILABLE',
            order_id = NULL,
            locked_by_user_id = NULL,
            locked_by_session_id = NULL,
            locked_at = NULL,
            lock_expires_at = NULL,
            reservation_id = NULL,
            reserved_at = NULL,
            reservation_expires_at = NULL,
            updated_at = NOW()
        WHERE order_id = :orderId
          AND status = 'RESERVED'
        """, nativeQuery = true)
    int restoreReservedSeatsForOrder(@Param("orderId") UUID orderId);

    @Modifying
    @Query(value = """
        UPDATE event_schema.event_seat_inventory
        SET status = 'SOLD',
            updated_at = NOW()
        WHERE order_id = :orderId
          AND status = 'RESERVED'
        """, nativeQuery = true)
    int confirmReservedSeatsForOrder(@Param("orderId") UUID orderId);

    @Modifying
    @Query(value = """
        UPDATE event_schema.event_seat_inventory
        SET ticket_id = :ticketId,
            updated_at = NOW()
        WHERE event_id = :eventId
          AND event_seat_id = :seatId
          AND order_id = :orderId
        """, nativeQuery = true)
    int attachTicketToSeatInventory(
        @Param("eventId") UUID eventId,
        @Param("seatId") UUID seatId,
        @Param("orderId") UUID orderId,
        @Param("ticketId") UUID ticketId
    );
}
