package com.flashticket.core.event.repository;

import com.flashticket.core.event.entity.EventImage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * EventImage Repository
 */
@Repository
public interface EventImageRepository extends JpaRepository<EventImage, UUID> {
    
    /**
     * Tìm tất cả images của 1 event (chưa bị xóa)
     */
    List<EventImage> findByEventIdAndIsDeletedFalseOrderByDisplayOrderAsc(UUID eventId);
    
    /**
     * Tìm primary banner của event
     */
    Optional<EventImage> findByEventIdAndImageTypeAndIsPrimaryTrueAndIsDeletedFalse(
        UUID eventId, 
        EventImage.ImageType imageType
    );
    
    /**
     * Tìm tất cả images theo type
     */
    List<EventImage> findByEventIdAndImageTypeAndIsDeletedFalseOrderByDisplayOrderAsc(
        UUID eventId,
        EventImage.ImageType imageType
    );
}
