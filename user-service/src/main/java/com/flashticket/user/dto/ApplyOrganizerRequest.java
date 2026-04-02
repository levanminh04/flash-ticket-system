package com.flashticket.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Request DTO cho đơn đăng ký trở thành Organizer.
 *
 * Sau khi nộp: OrganizerProfile.status = PENDING.
 * Admin duyệt → status = ACTIVE → gán role ORGANIZER trong Keycloak.
 */
public record ApplyOrganizerRequest(
        @NotBlank(message = "Organizer name is required")
        @Size(max = 200, message = "Organizer name must not exceed 200 characters")
        String organizerName,

        @NotBlank(message = "Organizer type is required")
        @Pattern(regexp = "^(INDIVIDUAL|COMPANY|NONPROFIT|GOVERNMENT)$",
                message = "Organizer type must be INDIVIDUAL, COMPANY, NONPROFIT, or GOVERNMENT")
        String organizerType,

        @Size(max = 500, message = "Description must not exceed 500 characters")
        String description,

        String websiteUrl,

        @NotBlank(message = "Contact email is required")
        @Email(message = "Invalid email format")
        String contactEmail,

        @NotBlank(message = "Contact phone is required")
        @Pattern(regexp = "^\\+?[0-9]{10,15}$", message = "Invalid phone number format")
        String contactPhone,

        // KYC fields — optional cho MVP, required cho production
        String taxCode,
        String representativeName
) {}
