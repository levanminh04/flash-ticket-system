package com.flashticket.user.repository;

import com.flashticket.user.model.OrganizerProfile;
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
     * Find organizer profile by slug
     */
    Optional<OrganizerProfile> findByOrganizerSlug(String slug);
    
    /**
     * Check if organizer exists by userId
     */
    boolean existsByUserId(String userId);
}
