package com.flashticket.user.service;

import com.flashticket.user.dto.OrganizerDTO;
import com.flashticket.user.model.OrganizerProfile;
import com.flashticket.user.repository.OrganizerProfileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Service for Organizer operations
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrganizerService {
    
    private final OrganizerProfileRepository organizerProfileRepository;
    
    /**
     * Get organizer profile by ID
     */
    public OrganizerDTO getOrganizerById(String organizerId) {
        log.info("Fetching organizer profile for ID: {}", organizerId);
        
        OrganizerProfile profile = organizerProfileRepository.findById(organizerId)
            .orElseThrow(() -> new RuntimeException("Organizer not found with ID: " + organizerId));
        
        return mapToDTO(profile);
    }
    
    /**
     * Get organizer profile by user ID
     */
    public OrganizerDTO getOrganizerByUserId(String userId) {
        log.info("Fetching organizer profile for user ID: {}", userId);
        
        OrganizerProfile profile = organizerProfileRepository.findByUserId(userId)
            .orElseThrow(() -> new RuntimeException("Organizer not found for user ID: " + userId));
        
        return mapToDTO(profile);
    }
    
    /**
     * Map OrganizerProfile entity to DTO
     */
    private OrganizerDTO mapToDTO(OrganizerProfile profile) {
        return OrganizerDTO.builder()
            .id(profile.getId())
            .userId(profile.getUserId())
            .name(profile.getOrganizerName())
            .slug(profile.getOrganizerSlug())
            .logoUrl(profile.getBranding() != null ? profile.getBranding().getLogoUrl() : null)
            .bannerUrl(profile.getBranding() != null ? profile.getBranding().getBannerUrl() : null)
            .description(profile.getDescription())
            .websiteUrl(profile.getBranding() != null ? profile.getBranding().getWebsiteUrl() : null)
            .isVerified(profile.getVerification() != null ? profile.getVerification().getIsVerified() : false)
            .totalEvents(profile.getStatistics() != null ? profile.getStatistics().getTotalEvents() : 0)
            .totalTicketsSold(profile.getStatistics() != null ? profile.getStatistics().getTotalTicketsSold() : 0)
            .followerCount(profile.getStatistics() != null ? profile.getStatistics().getFollowerCount() : 0)
            .averageRating(profile.getStatistics() != null ? profile.getStatistics().getAverageRating() : 0.0)
            .email(profile.getContact() != null ? profile.getContact().getEmail() : null)
            .phone(profile.getContact() != null ? profile.getContact().getPhone() : null)
            .build();
    }
}
