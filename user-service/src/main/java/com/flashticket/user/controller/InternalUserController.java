package com.flashticket.user.controller;

import com.flashticket.user.dto.UserResponse;
import com.flashticket.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Internal API Controller — S2S calls (from core-service).
 *
 * Tất cả endpoints dưới /api/internal/** đã permitAll trong SecurityConfig.
 * Bảo mật dựa vào network isolation (chỉ các service trong Eureka network có thể gọi).
 *
 * Trong production, nên dùng mTLS hoặc service-account JWT để xác thực S2S.
 */
@RestController
@RequestMapping("/api/internal/users")
@RequiredArgsConstructor
@Slf4j
public class InternalUserController {

    private final UserService userService;

    /**
     * GET /api/internal/users/{userId}
     * core-service gọi khi cần thông tin user (VD: email để gửi notification).
     */
    @GetMapping("/{userId}")
    public ResponseEntity<UserResponse> getUserById(@PathVariable String userId) {
        log.debug("GET /api/internal/users/{} (S2S)", userId);
        UserResponse response = userService.getMe(userId);
        return ResponseEntity.ok(response);
    }
}
