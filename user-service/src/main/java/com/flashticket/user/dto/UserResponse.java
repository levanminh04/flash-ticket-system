package com.flashticket.user.dto;

import com.flashticket.user.model.UserRole;
import lombok.Data;

import java.util.List;

/**
 * Response DTO for User
 * Flattened view of User entity for API consumers
 */
@Data
public class UserResponse {
    private String id;
    private String keycloakId;   // was "keyCloakId" (typo fixed)
    private String firstName;    // from user.profile.firstName
    private String lastName;     // from user.profile.lastName
    private String displayName;  // from user.profile.displayName
    private String avatarUrl;    // from user.profile.avatarUrl
    private String email;
    private String phone;
    private List<UserRole> roles; // was single UserRole role
    private String status;
    private AddressDTO address;  // default address from user.addresses list
}
