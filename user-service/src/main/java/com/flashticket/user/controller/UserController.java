package com.flashticket.user.controller;

import com.flashticket.user.dto.UpdateProfileRequest;
import com.flashticket.user.dto.UserResponse;
import com.flashticket.user.service.StorageService;
import com.flashticket.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

/**
 * User Profile Controller.
 *
 * Endpoints:
 *   GET  /api/users/me                → Lấy profile hiện tại
 *   PUT  /api/users/me/profile        → Cập nhật thông tin cá nhân
 *   POST /api/users/me/avatar         → Tải lên avatar
 *
 * IDOR Protection: userId luôn lấy từ JWT (@AuthenticationPrincipal Jwt jwt).
 * KHÔNG bao giờ nhận userId từ request path/body.
 *
 * Security: Tất cả endpoints yêu cầu authenticated (cấu hình trong SecurityConfig).
 * Role-check bổ sung qua @PreAuthorize ở method level.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/users")
@Slf4j
public class UserController {

    private final UserService userService;
    private final StorageService storageService;

    /**
     * GET /api/users/me
     * Lấy full profile của user hiện tại từ MongoDB.
     */
    @GetMapping("/me")
    public ResponseEntity<UserResponse> getMe(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        log.debug("GET /api/users/me — userId: {}", userId);

        UserResponse response = userService.getMe(userId);
        return ResponseEntity.ok(response);
    }

    /**
     * PUT /api/users/me/profile
     * Cập nhật thông tin cá nhân.
     * Email KHÔNG cho phép update qua endpoint này (Keycloak SSOT).
     */
    @PutMapping("/me/profile")
    public ResponseEntity<UserResponse> updateProfile(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody UpdateProfileRequest request) {

        String userId = jwt.getSubject();
        log.info("PUT /api/users/me/profile — userId: {}", userId);

        UserResponse response = userService.updateProfile(userId, request);
        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/users/me/avatar
     * Tải lên và cập nhật Avatar.
     */
    @PostMapping("/me/avatar")
    public ResponseEntity<UserResponse> uploadAvatar(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("file") MultipartFile file) {

        String userId = jwt.getSubject();
        log.info("POST /api/users/me/avatar — userId: {}", userId);

        String avatarUrl = storageService.uploadAvatar(userId, file);
        UserResponse response = userService.updateAvatarUrl(userId, avatarUrl);

        return ResponseEntity.ok(response);
    }
}
