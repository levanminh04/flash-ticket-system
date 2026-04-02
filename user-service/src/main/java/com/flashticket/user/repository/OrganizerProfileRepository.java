package com.flashticket.user.repository;

import com.flashticket.user.model.OrganizerProfile;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository for OrganizerProfile
 */
@Repository
public interface OrganizerProfileRepository extends MongoRepository<OrganizerProfile, String> {

    /**
     * Find organizer profile by userId
     */
    Optional<OrganizerProfile> findByUserId(String userId);

    /**
     * Find organizer profile by slug (public page)
     */
    Optional<OrganizerProfile> findByOrganizerSlug(String slug);

    /**
     * Check if organizer exists by userId
     */
    boolean existsByUserId(String userId);

    /**
     * Check if slug already taken
     */
    boolean existsByOrganizerSlug(String slug);

    // ── Admin queries ────────────────────────────────────────────────

    /**
     * Lấy danh sách organizer theo status (Admin: xem pending, active, rejected...)
     */
    Page<OrganizerProfile> findByStatusAndIsDeletedFalse(
            OrganizerProfile.OrganizerStatus status, Pageable pageable);

    /**
     * Lấy tất cả organizer chưa bị xóa
     */
    Page<OrganizerProfile> findByIsDeletedFalse(Pageable pageable);
}
