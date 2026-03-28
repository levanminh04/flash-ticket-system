package com.flashticket.core.event.repository;

import com.flashticket.core.event.entity.Venue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Repository cho Venue
 */
@Repository
public interface VenueRepository extends JpaRepository<Venue, UUID> {
    
    /**
     * Tìm tất cả địa điểm đang hoạt động và chưa bị xóa
     */
    List<Venue> findByIsActiveTrueAndIsDeletedFalseOrderByCityAscNameAsc();
}
