package com.flashticket.core.event.repository;

import com.flashticket.core.event.entity.EventSeat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Repository
public interface EventSeatRepository extends JpaRepository<EventSeat, UUID> {

    @Query("""
           SELECT s FROM EventSeat s
           WHERE s.sector.id = :sectorId
             AND s.isActive = true
           ORDER BY s.rowName ASC, s.seatNumber ASC
           """)
    List<EventSeat> findBySectorIdAndIsActiveTrue(@Param("sectorId") UUID sectorId);

    @Query("""
           SELECT s FROM EventSeat s
           WHERE s.sector.id = :sectorId
           ORDER BY s.rowName ASC, s.seatNumber ASC
           """)
    List<EventSeat> findAllBySectorId(@Param("sectorId") UUID sectorId);

    @Query("""
           SELECT s FROM EventSeat s
           WHERE s.sector.id IN :sectorIds
           ORDER BY s.rowName ASC, s.seatNumber ASC
           """)
    List<EventSeat> findAllBySectorIdIn(@Param("sectorIds") Collection<UUID> sectorIds);

    @Query("""
           SELECT COUNT(s) FROM EventSeat s
           WHERE s.ticketTypeId = :ticketTypeId
             AND s.isActive = true
           """)
    long countByTicketTypeIdAndIsActiveTrue(@Param("ticketTypeId") UUID ticketTypeId);

    @Query("""
           SELECT s.ticketTypeId, COUNT(s) FROM EventSeat s
           WHERE s.ticketTypeId IN :ticketTypeIds
             AND s.isActive = true
           GROUP BY s.ticketTypeId
           """)
    List<Object[]> countActiveSeatsByTicketTypeIds(@Param("ticketTypeIds") Collection<UUID> ticketTypeIds);

    @Query("""
           SELECT s.id FROM EventSeat s
           WHERE s.id IN :seatIds
           """)
    Set<UUID> findExistingIds(@Param("seatIds") Collection<UUID> seatIds);

    @Query("""
           SELECT CASE WHEN COUNT(s) > 0 THEN true ELSE false END
           FROM EventSeat s
           WHERE s.ticketTypeId = :ticketTypeId
             AND s.isActive = true
           """)
    boolean existsActiveByTicketTypeId(@Param("ticketTypeId") UUID ticketTypeId);

    @Modifying
    @Query("""
           UPDATE EventSeat s
           SET s.colorCode = :colorCode
           WHERE s.ticketTypeId = :ticketTypeId
           """)
    int updateColorCodeByTicketTypeId(
        @Param("ticketTypeId") UUID ticketTypeId,
        @Param("colorCode") String colorCode
    );
}
