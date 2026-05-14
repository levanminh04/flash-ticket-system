package com.flashticket.discovery.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Chat request DTO.
 *
 * @param sessionId unique session identifier for conversation continuity
 * @param message   user's message (max 2000 chars)
 */
public record ChatRequest(
    @NotBlank String sessionId,
    @NotBlank @Size(max = 2000) String message
) {}
