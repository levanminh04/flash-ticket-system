package com.flashticket.user.controller;

import com.flashticket.user.dto.ApplyOrganizerRequest;
import com.flashticket.user.dto.OrganizerDTO;
import com.flashticket.user.dto.VerifyOrganizerRequest;
import com.flashticket.user.dto.FollowResponse;
import com.flashticket.user.model.OrganizerProfile;
import com.flashticket.user.service.FollowService;
import com.flashticket.user.service.OrganizerService;
import com.flashticket.user.service.StorageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * Organizer Controller.
 *
 * Endpoints chia theo access level:
 *   PUBLIC:     GET /api/organizers/public/{slug}
 *   BUYER:      POST /api/organizers/apply
 *               POST /api/organizers/{id}/follow
 *               DELETE /api/organizers/{id}/follow
 *               GET /api/organizers/{id}/is-following
 *   ORGANIZER:  GET /api/organizers/me
 *               POST /api/organizers/me/logo
 *               POST /api/organizers/me/banner
 *   ADMIN:      GET /api/admin/organizers?status=PENDING
 *               PUT /api/admin/organizers/{id}/verify
 *   INTERNAL:   GET /api/internal/organizers/{organizerId}       (S2S từ core-service)
 *               GET /api/internal/organizers/by-user/{userId}    (S2S từ core-service)
 */
@RestController
@RequiredArgsConstructor
@Slf4j
public class OrganizerController {

    private final OrganizerService organizerService;
    private final StorageService storageService;
    private final FollowService followService;

    // ═══════════════════════════════════════════════════════
    // PUBLIC — Không cần JWT (permitAll trong SecurityConfig)
    // ═══════════════════════════════════════════════════════

    /**
     * GET /api/organizers/public/{slug}
     * Public organizer profile page — xem thông tin OrganizerProfile theo slug.
     */
    @GetMapping("/api/organizers/public/{slug}")
    public ResponseEntity<OrganizerDTO> getOrganizerBySlug(@PathVariable String slug) {
        log.debug("GET /api/organizers/public/{}", slug);
        OrganizerDTO organizer = organizerService.getOrganizerBySlug(slug);
        return ResponseEntity.ok(organizer);
    }

    // ═══════════════════════════════════════════════════════
    // BUYER — Đăng ký làm Organizer & Follow
    // ═══════════════════════════════════════════════════════

    /**
     * POST /api/organizers/apply
     * Buyer nộp đơn đăng ký trở thành Organizer.
     */
    @PostMapping("/api/organizers/apply")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<OrganizerDTO> applyForOrganizer(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ApplyOrganizerRequest request) {

        String userId = jwt.getSubject();
        log.info("POST /api/organizers/apply — userId: {}", userId);

        OrganizerDTO response = organizerService.applyForOrganizer(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/api/organizers/{organizerProfileId}/follow")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<FollowResponse> followOrganizer(
            @PathVariable String organizerProfileId,
            @AuthenticationPrincipal Jwt jwt) {
        
        String userId = jwt.getSubject();
        return ResponseEntity.ok(followService.followOrganizer(userId, organizerProfileId));
    }

    @DeleteMapping("/api/organizers/{organizerProfileId}/follow")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<FollowResponse> unfollowOrganizer(
            @PathVariable String organizerProfileId,
            @AuthenticationPrincipal Jwt jwt) {
        
        String userId = jwt.getSubject();
        return ResponseEntity.ok(followService.unfollowOrganizer(userId, organizerProfileId));
    }

    @GetMapping("/api/organizers/{organizerProfileId}/is-following")
    @PreAuthorize("hasRole('BUYER')")
    public ResponseEntity<Map<String, Boolean>> isFollowing(
            @PathVariable String organizerProfileId,
            @AuthenticationPrincipal Jwt jwt) {
        
        String userId = jwt.getSubject();
        boolean isFollowing = followService.checkFollowStatus(userId, organizerProfileId);
        return ResponseEntity.ok(Map.of("isFollowing", isFollowing));
    }

    // ═══════════════════════════════════════════════════════
    // ORGANIZER — Quản lý profile của mình
    // ═══════════════════════════════════════════════════════

    /**
     * GET /api/organizers/me
     * Organizer xem profile của chính mình.
     */
    @GetMapping("/api/organizers/me")
    @PreAuthorize("hasAnyRole('ORGANIZER', 'ADMIN')")
    public ResponseEntity<OrganizerDTO> getMyOrganizerProfile(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        log.debug("GET /api/organizers/me — userId: {}", userId);

        OrganizerDTO organizer = organizerService.getOrganizerByUserId(userId);
        return ResponseEntity.ok(organizer);
    }

    /**
     * POST /api/organizers/me/logo
     * Organizer upload logo.
     */
    @PostMapping("/api/organizers/me/logo")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<OrganizerDTO> uploadLogo(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("file") MultipartFile file) {

        String userId = jwt.getSubject();
        log.info("POST /api/organizers/me/logo — userId: {}", userId);

        OrganizerDTO organizer = organizerService.getOrganizerByUserId(userId);
        String logoUrl = storageService.uploadOrganizerLogo(organizer.getId(), file);
        OrganizerDTO response = organizerService.updateLogoUrl(organizer.getId(), logoUrl);

        return ResponseEntity.ok(response);
    }

    /**
     * POST /api/organizers/me/banner
     * Organizer upload banner.
     */
    @PostMapping("/api/organizers/me/banner")
    @PreAuthorize("hasRole('ORGANIZER')")
    public ResponseEntity<OrganizerDTO> uploadBanner(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("file") MultipartFile file) {

        String userId = jwt.getSubject();
        log.info("POST /api/organizers/me/banner — userId: {}", userId);

        OrganizerDTO organizer = organizerService.getOrganizerByUserId(userId);
        String bannerUrl = storageService.uploadOrganizerBanner(organizer.getId(), file);
        OrganizerDTO response = organizerService.updateBannerUrl(organizer.getId(), bannerUrl);

        return ResponseEntity.ok(response);
    }

    // ═══════════════════════════════════════════════════════
    // ADMIN — Duyệt đơn đăng ký Organizer
    // ═══════════════════════════════════════════════════════

    /**
     * GET /api/admin/organizers?status=PENDING
     * Admin xem danh sách organizer profiles theo trạng thái.
     */
    @GetMapping("/api/admin/organizers")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<OrganizerDTO>> getOrganizersByStatus(
            @RequestParam(defaultValue = "PENDING") String status,
            @PageableDefault(size = 20) Pageable pageable) {

        log.info("GET /api/admin/organizers?status={}", status);

        OrganizerProfile.OrganizerStatus organizerStatus;
        try {
            organizerStatus = OrganizerProfile.OrganizerStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            organizerStatus = OrganizerProfile.OrganizerStatus.PENDING;
        }

        Page<OrganizerDTO> result = organizerService.getOrganizersByStatus(organizerStatus, pageable);
        return ResponseEntity.ok(result);
    }

    /**
     * PUT /api/admin/organizers/{organizerProfileId}/verify
     * Admin duyệt hoặc từ chối đơn đăng ký organizer.
     * Khi duyệt: tự động gán role ORGANIZER trong Keycloak.
     */
    @PutMapping("/api/admin/organizers/{organizerProfileId}/verify")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<OrganizerDTO> verifyOrganizer(
            @PathVariable String organizerProfileId,
            @Valid @RequestBody VerifyOrganizerRequest request,
            @AuthenticationPrincipal Jwt jwt) {

        String adminUserId = jwt.getSubject();
        log.info("PUT /api/admin/organizers/{}/verify — admin: {}, approved: {}",
                organizerProfileId, adminUserId, request.approved());

        OrganizerDTO response = organizerService.verifyOrganizer(
                organizerProfileId, request, adminUserId);
        return ResponseEntity.ok(response);
    }

    // ═══════════════════════════════════════════════════════
    // INTERNAL — S2S calls từ core-service (permitAll + network isolation)
    // ═══════════════════════════════════════════════════════

    /**
     * GET /api/internal/organizers/{organizerId}
     * core-service UserServiceClient gọi endpoint này khi cần OrganizerProfile.
     */
    @GetMapping("/api/internal/organizers/{organizerId}")
    public ResponseEntity<OrganizerDTO> getOrganizerById(@PathVariable String organizerId) {
        log.debug("GET /api/internal/organizers/{} (S2S)", organizerId);
        OrganizerDTO organizer = organizerService.getOrganizerById(organizerId);
        return ResponseEntity.ok(organizer);
    }

    /**
     * GET /api/internal/organizers/by-user/{userId}
     * core-service có thể resolve organizer profile bằng userId.
     */
    @GetMapping("/api/internal/organizers/by-user/{userId}")
    public ResponseEntity<OrganizerDTO> getOrganizerByUserId(@PathVariable String userId) {
        log.debug("GET /api/internal/organizers/by-user/{} (S2S)", userId);
        OrganizerDTO organizer = organizerService.getOrganizerByUserId(userId);
        return ResponseEntity.ok(organizer);
    }
}
