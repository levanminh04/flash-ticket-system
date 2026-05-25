package com.flashticket.core.event.repository;

import com.flashticket.core.event.entity.EventSector;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Repository
public interface EventSectorRepository extends JpaRepository<EventSector, UUID> {

    @Query("""
           SELECT s FROM EventSector s
           WHERE s.layout.id = :layoutId
             AND s.isActive = true
           ORDER BY s.displayOrder ASC, s.createdAt ASC
           """)
    List<EventSector> findByLayoutIdAndIsActiveTrue(@Param("layoutId") UUID layoutId);

    @Query("""
           SELECT s FROM EventSector s
           WHERE s.layout.id = :layoutId
           ORDER BY s.displayOrder ASC, s.createdAt ASC
           """)
    List<EventSector> findAllByLayoutId(@Param("layoutId") UUID layoutId);

    @Query("""
           SELECT CASE WHEN COUNT(s) > 0 THEN true ELSE false END
           FROM EventSector s
           WHERE s.id = :sectorId
             AND s.layout.event.id = :eventId
           """)
    boolean existsByIdAndEventId(@Param("sectorId") UUID sectorId, @Param("eventId") UUID eventId);

    @Query("""
           SELECT s.id FROM EventSector s
           WHERE s.id IN :sectorIds
           """)
    Set<UUID> findExistingIds(@Param("sectorIds") Collection<UUID> sectorIds);
}
