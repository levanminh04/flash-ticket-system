package com.flashticket.user.dto;

import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/**
 * Request DTO cho cập nhật thông tin cá nhân user.
 *
 * Partial Update: Chỉ field nào không null mới được cập nhật.
 * Email KHÔNG có ở đây — Keycloak quản lý email (SSOT).
 *   → User đổi email qua Keycloak → SPI/Self-Healing tự sync về MongoDB.
 */
public record UpdateProfileRequest(
        @Size(max = 100, message = "First name must not exceed 100 characters")
        String firstName,

        @Size(max = 100, message = "Last name must not exceed 100 characters")
        String lastName,

        @Size(max = 200, message = "Display name must not exceed 200 characters")
        String displayName,

        @Size(max = 500, message = "Bio must not exceed 500 characters")
        String bio,

        @Past(message = "Date of birth must be in the past")
        LocalDate dateOfBirth,

        @Pattern(regexp = "^(MALE|FEMALE|OTHER|PREFER_NOT_TO_SAY)$",
                message = "Gender must be MALE, FEMALE, OTHER, or PREFER_NOT_TO_SAY")
        String gender,

        @Pattern(regexp = "^\\+?[0-9]{10,15}$", message = "Invalid phone number format")
        String phone
) {}
