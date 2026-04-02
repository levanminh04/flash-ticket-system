package com.flashticket.user.dto;

import com.flashticket.user.model.User;
import com.flashticket.user.model.UserRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Response DTO for User profile.
 *
 * Thiết kế phẳng (flatten) để Frontend dễ consume.
 * Chỉ expose những thông tin mà Frontend cần — ẩn security fields.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserResponse {
    private String id;
    private String keycloakId;

    // Profile — flatten từ User.Profile
    private String firstName;
    private String lastName;
    private String displayName;
    private String avatarUrl;
    private String bio;
    private String dateOfBirth;
    private String gender;

    // Contact
    private String email;
    private Boolean emailVerified;
    private String phone;
    private Boolean phoneVerified;

    // Roles & Status
    private List<UserRole> roles;
    private String status;

    // Organizer reference
    private String organizerProfileId;

    // Preferences
    private String language;
    private String timezone;
    private String currency;

    // Activity
    private Instant lastLoginAt;

    // Audit
    private Instant createdAt;
    private Instant updatedAt;

    /**
     * Factory method: Entity → DTO
     * Centralized mapping — tránh logic map rải rác ở nhiều nơi.
     */
    public static UserResponse from(User user) {
        if (user == null) return null;

        UserResponseBuilder builder = UserResponse.builder()
                .id(user.getId())
                .keycloakId(user.getKeycloakId())
                .email(user.getEmail())
                .emailVerified(user.getEmailVerified())
                .phone(user.getPhone())
                .phoneVerified(user.getPhoneVerified())
                .roles(user.getRoles())
                .status(user.getStatus() != null ? user.getStatus().name() : null)
                .organizerProfileId(user.getOrganizerProfileId())
                .lastLoginAt(user.getLastLoginAt())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt());

        // Profile flatten
        if (user.getProfile() != null) {
            builder.firstName(user.getProfile().getFirstName())
                    .lastName(user.getProfile().getLastName())
                    .displayName(user.getProfile().getDisplayName())
                    .avatarUrl(user.getProfile().getAvatarUrl())
                    .bio(user.getProfile().getBio())
                    .dateOfBirth(user.getProfile().getDateOfBirth() != null
                            ? user.getProfile().getDateOfBirth().toString() : null)
                    .gender(user.getProfile().getGender() != null
                            ? user.getProfile().getGender().name() : null);
        }

        // Preferences flatten
        if (user.getPreferences() != null) {
            builder.language(user.getPreferences().getLanguage())
                    .timezone(user.getPreferences().getTimezone())
                    .currency(user.getPreferences().getCurrency());
        }

        return builder.build();
    }
}
