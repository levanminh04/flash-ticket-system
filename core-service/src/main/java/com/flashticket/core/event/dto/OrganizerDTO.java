package com.flashticket.core.event.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for Organizer information (from User Service)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrganizerDTO {
    private String id; // organizerProfileId
    private String userId;
    private String name;
    private String slug;
    private String logoUrl;
    private String bannerUrl;
    private String description;
    private String websiteUrl;
    private Boolean isVerified;
    
    // Statistics
    private Integer totalEvents;
    private Integer totalTicketsSold;
    private Integer followerCount;
    private Double averageRating;
    
    // Contact
    private String email;
    private String phone;
}
