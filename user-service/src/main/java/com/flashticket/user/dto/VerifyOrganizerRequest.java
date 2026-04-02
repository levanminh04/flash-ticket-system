package com.flashticket.user.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Request DTO cho Admin duyệt/từ chối OrganizerProfile.
 */
public record VerifyOrganizerRequest(
        @NotNull(message = "Approved status is required")
        Boolean approved,

        String rejectionReason  // Required nếu approved = false, validate ở Service layer
) {}
