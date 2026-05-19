package com.flashticket.discovery.chat.controller;

import com.flashticket.discovery.chat.dto.*;
import com.flashticket.discovery.chat.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

/**
 * Chat REST API controller.
 *
 * POST /api/chat — Send message, receive AI response.
 * Requires authenticated JWT (user must be logged in).
 */
@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @PostMapping
    public ResponseEntity<ChatResponse> chat(
            @Valid @RequestBody ChatRequest request,
            @AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        String jwtToken = jwt.getTokenValue();
        String userName = jwt.getClaimAsString("name");
        String userEmail = jwt.getClaimAsString("email");

        ChatResponse response = chatService.processMessage(
                userId, request.sessionId(), request.message(), jwtToken,
                userName != null ? userName : "Khách",
                userEmail != null ? userEmail : "N/A");

        return ResponseEntity.ok(response);
    }
}
