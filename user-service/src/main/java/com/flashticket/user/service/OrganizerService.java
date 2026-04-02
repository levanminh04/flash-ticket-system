package com.flashticket.user.service;

import com.flashticket.user.common.exception.ConflictException;
import com.flashticket.user.common.exception.InvalidRequestException;
import com.flashticket.user.common.exception.ResourceNotFoundException;
import com.flashticket.user.dto.ApplyOrganizerRequest;
import com.flashticket.user.dto.OrganizerDTO;
import com.flashticket.user.dto.VerifyOrganizerRequest;
import com.flashticket.user.model.OrganizerProfile;
import com.flashticket.user.model.User;
import com.flashticket.user.model.UserRole;
import com.flashticket.user.repository.OrganizerProfileRepository;
import com.flashticket.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.time.Instant;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Organizer Profile Service.
 *
 * Responsibilities:
 *   - getOrganizerById/ByUserId/BySlug: Đọc profile (cho core-service S2S và public page).
 *   - applyForOrganizer: Buyer nộp đơn đăng ký làm Organizer.
 *   - verifyOrganizer: Admin duyệt/từ chối đơn đăng ký.
 *   - getPendingOrganizers: Admin xem danh sách đơn chờ duyệt.
 *
 * Transaction Challenge (MongoDB + Keycloak):
 *   verifyOrganizer() phải update cả MongoDB (profile status, user role)
 *   VÀ Keycloak (gán realm role). Vì không thể wrap 2 hệ thống trong 1 transaction,
 *   chiến lược là:
 *     1. Lưu MongoDB TRƯỚC.
 *     2. Gọi Keycloak SAU.
 *     3. Nếu Keycloak fail → log error, Admin re-verify thủ công.
 *        (MongoDB đã đúng, JWT role sẽ được Self-Healing sync.)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrganizerService {

    private final OrganizerProfileRepository organizerProfileRepository;
    private final UserRepository userRepository;
    private final KeycloakAdminService keycloakAdminService;

    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^a-z0-9-]");
    private static final Pattern MULTIPLE_DASHES = Pattern.compile("-{2,}");

    // ═══════════════════════════════════════════════════════
    // READ — Dùng cho cả Public page và S2S (core-service)
    // ═══════════════════════════════════════════════════════

    /**
     * Lấy OrganizerProfile theo ID.
     * Dùng bởi: core-service UserServiceClient (S2S).
     */
    public OrganizerDTO getOrganizerById(String organizerId) {
        log.debug("Fetching organizer profile by id: {}", organizerId);

        OrganizerProfile profile = organizerProfileRepository.findById(organizerId)
                .orElseThrow(() -> new ResourceNotFoundException("OrganizerProfile", "id", organizerId));

        return mapToDTO(profile);
    }

    /**
     * Lấy OrganizerProfile theo userId.
     * Dùng bởi: Frontend (trang quản lý organizer của user hiện tại).
     */
    public OrganizerDTO getOrganizerByUserId(String userId) {
        log.debug("Fetching organizer profile by userId: {}", userId);

        OrganizerProfile profile = organizerProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new ResourceNotFoundException("OrganizerProfile", "userId", userId));

        return mapToDTO(profile);
    }

    /**
     * Lấy OrganizerProfile theo slug (URL-friendly).
     * Dùng bởi: Public page organizer (permitAll trong SecurityConfig).
     */
    public OrganizerDTO getOrganizerBySlug(String slug) {
        log.debug("Fetching organizer profile by slug: {}", slug);

        OrganizerProfile profile = organizerProfileRepository.findByOrganizerSlug(slug)
                .orElseThrow(() -> new ResourceNotFoundException("OrganizerProfile", "slug", slug));

        return mapToDTO(profile);
    }

    // ═══════════════════════════════════════════════════════
    // APPLY — Buyer nộp đơn đăng ký Organizer
    // ═══════════════════════════════════════════════════════

    /**
     * Buyer nộp đơn đăng ký trở thành Organizer.
     *
     * Business rules:
     *   1. User phải tồn tại trong MongoDB.
     *   2. User chưa có OrganizerProfile (prevent duplicate application).
     *   3. Generate unique slug từ organizerName.
     *   4. Tạo OrganizerProfile: status = PENDING.
     *   5. Link OrganizerProfile ID ngược về User document.
     *   6. KHÔNG gán role ORGANIZER ngay — đợi Admin duyệt.
     */
    public OrganizerDTO applyForOrganizer(String userId, ApplyOrganizerRequest req) {
        log.info("User '{}' applying for Organizer: '{}'", userId, req.organizerName());

        // 1. Verify user tồn tại
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        // 2. Prevent duplicate application
        if (organizerProfileRepository.existsByUserId(userId)) {
            throw new ConflictException("User already has an organizer profile. " +
                    "Cannot submit another application.");
        }

        // 3. Generate unique slug
        String slug = generateUniqueSlug(req.organizerName());

        // 4. Build OrganizerProfile
        OrganizerProfile profile = OrganizerProfile.builder()
                .id(UUID.randomUUID().toString())
                .userId(userId)
                .organizerName(req.organizerName())
                .organizerSlug(slug)
                .organizerType(OrganizerProfile.OrganizerType.valueOf(req.organizerType()))
                .description(req.description())
                .branding(OrganizerProfile.Branding.builder()
                        .websiteUrl(req.websiteUrl())
                        .build())
                .contact(OrganizerProfile.Contact.builder()
                        .email(req.contactEmail())
                        .phone(req.contactPhone())
                        .build())
                .businessInfo(OrganizerProfile.BusinessInfo.builder()
                        .taxCode(req.taxCode())
                        .representativeName(req.representativeName())
                        .build())
                .status(OrganizerProfile.OrganizerStatus.PENDING)
                .isDeleted(false)
                .build();

        profile = organizerProfileRepository.save(profile);
        log.info("Created OrganizerProfile: id={}, slug={}, status=PENDING", profile.getId(), slug);

        // 5. Link ngược về User document
        user.setOrganizerProfileId(profile.getId());
        userRepository.save(user);
        log.info("Linked OrganizerProfile '{}' to User '{}'", profile.getId(), userId);

        return mapToDTO(profile);
    }

    // ═══════════════════════════════════════════════════════
    // VERIFY — Admin duyệt/từ chối đơn đăng ký
    // ═══════════════════════════════════════════════════════

    /**
     * Admin duyệt hoặc từ chối đơn đăng ký Organizer.
     *
     * Transaction Challenge:
     *   MongoDB + Keycloak = 2 hệ thống riêng, không thể atomic.
     *   Chiến lược: MongoDB first → Keycloak second.
     *     Ok: Cả 2 thành công.
     *     Partial fail: MongoDB ACTIVE nhưng Keycloak chưa gán role.
     *       → JwtSelfHealingFilter sẽ không giúp được vì nó chỉ sync profile, không sync role.
     *       → Cần Admin retry hoặc cron job re-sync.
     *       → Log ERROR rõ ràng để admin nhận biết.
     */
    public OrganizerDTO verifyOrganizer(String organizerProfileId, VerifyOrganizerRequest req, String adminUserId) {
        log.info("Admin '{}' {} organizer '{}'",
                adminUserId, req.approved() ? "APPROVING" : "REJECTING", organizerProfileId);

        // 1. Find OrganizerProfile
        OrganizerProfile profile = organizerProfileRepository.findById(organizerProfileId)
                .orElseThrow(() -> new ResourceNotFoundException("OrganizerProfile", "id", organizerProfileId));

        // Chỉ duyệt profile đang PENDING
        if (profile.getStatus() != OrganizerProfile.OrganizerStatus.PENDING) {
            throw new InvalidRequestException(
                    "OrganizerProfile not in PENDING status. Current status: " + profile.getStatus());
        }

        if (req.approved()) {
            return handleApproval(profile, adminUserId);
        } else {
            return handleRejection(profile, req.rejectionReason(), adminUserId);
        }
    }

    /**
     * Admin: Lấy danh sách organizer theo status (phân trang).
     */
    public Page<OrganizerDTO> getOrganizersByStatus(OrganizerProfile.OrganizerStatus status, Pageable pageable) {
        log.debug("Admin fetching organizers by status: {}", status);

        return organizerProfileRepository
                .findByStatusAndIsDeletedFalse(status, pageable)
                .map(this::mapToDTO);
    }

    // ═══════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════

    public OrganizerDTO updateLogoUrl(String organizerProfileId, String logoUrl) {
        log.info("Updating logo for organizer: {}", organizerProfileId);
        
        OrganizerProfile profile = organizerProfileRepository.findById(organizerProfileId)
                .orElseThrow(() -> new ResourceNotFoundException("OrganizerProfile", "id", organizerProfileId));
        
        if (profile.getBranding() == null) {
            profile.setBranding(new OrganizerProfile.Branding());
        }
        profile.getBranding().setLogoUrl(logoUrl);
        
        return mapToDTO(organizerProfileRepository.save(profile));
    }

    public OrganizerDTO updateBannerUrl(String organizerProfileId, String bannerUrl) {
        log.info("Updating banner for organizer: {}", organizerProfileId);
        
        OrganizerProfile profile = organizerProfileRepository.findById(organizerProfileId)
                .orElseThrow(() -> new ResourceNotFoundException("OrganizerProfile", "id", organizerProfileId));
        
        if (profile.getBranding() == null) {
            profile.setBranding(new OrganizerProfile.Branding());
        }
        profile.getBranding().setBannerUrl(bannerUrl);
        
        return mapToDTO(organizerProfileRepository.save(profile));
    }

    private OrganizerDTO handleApproval(OrganizerProfile profile, String adminUserId) {
        String userId = profile.getUserId();

        // Step 1: Update OrganizerProfile → ACTIVE
        profile.setStatus(OrganizerProfile.OrganizerStatus.ACTIVE);

        OrganizerProfile.Verification verification = profile.getVerification();
        if (verification == null) verification = new OrganizerProfile.Verification();
        verification.setIsVerified(true);
        verification.setVerifiedAt(Instant.now());
        verification.setVerifiedBy(adminUserId);
        profile.setVerification(verification);

        organizerProfileRepository.save(profile);
        log.info("OrganizerProfile '{}' approved by admin '{}'", profile.getId(), adminUserId);

        // Step 2: Update User → thêm role ORGANIZER vào MongoDB
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));

        if (!user.getRoles().contains(UserRole.ORGANIZER)) {
            user.getRoles().add(UserRole.ORGANIZER);
            userRepository.save(user);
            log.info("Added ORGANIZER role to user '{}' in MongoDB", userId);
        }

        // Step 3: Gán role ORGANIZER trong Keycloak
        // Nếu step này fail, MongoDB đã đúng nhưng JWT của user chưa có role mới.
        // User cần được Admin re-verify hoặc wait until next login cycle.
        try {
            keycloakAdminService.assignRoleToUser(userId, "ORGANIZER");
            log.info("Assigned ORGANIZER role in Keycloak for user '{}'", userId);
        } catch (Exception ex) {
            // KHÔNG throw — MongoDB đã được update thành công.
            // Log ERROR đậm để admin nhận ra cần retry.
            log.error("[CRITICAL] Failed to assign ORGANIZER role in Keycloak for user '{}'. " +
                    "MongoDB is ACTIVE but Keycloak role is NOT assigned. " +
                    "Admin must manually retry. Error: {}", userId, ex.getMessage());
        }

        return mapToDTO(profile);
    }

    private OrganizerDTO handleRejection(OrganizerProfile profile, String rejectionReason, String adminUserId) {
        if (!StringUtils.hasText(rejectionReason)) {
            throw new InvalidRequestException("Rejection reason is required when rejecting an organizer");
        }

        profile.setStatus(OrganizerProfile.OrganizerStatus.REJECTED);

        OrganizerProfile.Verification verification = profile.getVerification();
        if (verification == null) verification = new OrganizerProfile.Verification();
        verification.setIsVerified(false);
        verification.setVerifiedAt(Instant.now());
        verification.setVerifiedBy(adminUserId);
        profile.setVerification(verification);

        organizerProfileRepository.save(profile);

        log.info("OrganizerProfile '{}' rejected by admin '{}'. Reason: {}",
                profile.getId(), adminUserId, rejectionReason);

        return mapToDTO(profile);
    }

    // ── Slug Generation — Mirror logic từ core-service OrganizerEventService ──

    /**
     * Generate URL-friendly slug từ tên organizer.
     * Cùng pattern với generateUniqueSlug() trong core-service.
     *
     * Ví dụ: "Công ty TNHH ABC Events" → "cong-ty-tnhh-abc-events"
     * Nếu trùng: append "-{random-suffix}"
     */
    String generateUniqueSlug(String name) {
        String slug = toSlug(name);

        // Kiểm tra unique
        if (!organizerProfileRepository.existsByOrganizerSlug(slug)) {
            return slug;
        }

        // Nếu trùng, thêm suffix 6-ký tự random
        String uniqueSlug;
        int attempts = 0;
        do {
            String suffix = UUID.randomUUID().toString().substring(0, 6);
            uniqueSlug = slug + "-" + suffix;
            attempts++;
            if (attempts > 10) {
                throw new InvalidRequestException("Unable to generate unique slug for: " + name);
            }
        } while (organizerProfileRepository.existsByOrganizerSlug(uniqueSlug));

        return uniqueSlug;
    }

    private String toSlug(String input) {
        if (input == null) return "";
        // Normalize Unicode (xử lý tiếng Việt: ê → e, ô → o)
        String normalized = Normalizer.normalize(input.toLowerCase().trim(), Normalizer.Form.NFD);
        // Xóa dấu tone marks
        normalized = normalized.replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        // Xóa ký tự đặc biệt, thay khoảng trắng bằng dấu gạch
        normalized = normalized.replace(' ', '-');
        normalized = NON_ALPHANUMERIC.matcher(normalized).replaceAll("");
        normalized = MULTIPLE_DASHES.matcher(normalized).replaceAll("-");
        // Trim dashes đầu cuối
        normalized = normalized.replaceAll("^-|-$", "");
        return normalized;
    }

    // ── Mapping ──────────────────────────────────────────────────────

    /**
     * Map OrganizerProfile entity → DTO.
     * Null-safe cho tất cả embedded objects.
     */
    private OrganizerDTO mapToDTO(OrganizerProfile profile) {
        return OrganizerDTO.builder()
                .id(profile.getId())
                .userId(profile.getUserId())
                .name(profile.getOrganizerName())
                .slug(profile.getOrganizerSlug())
                .logoUrl(profile.getBranding() != null ? profile.getBranding().getLogoUrl() : null)
                .bannerUrl(profile.getBranding() != null ? profile.getBranding().getBannerUrl() : null)
                .description(profile.getDescription())
                .websiteUrl(profile.getBranding() != null ? profile.getBranding().getWebsiteUrl() : null)
                .isVerified(profile.getVerification() != null ? profile.getVerification().getIsVerified() : false)
                .totalEvents(profile.getStatistics() != null ? profile.getStatistics().getTotalEvents() : 0)
                .totalTicketsSold(profile.getStatistics() != null ? profile.getStatistics().getTotalTicketsSold() : 0)
                .followerCount(profile.getStatistics() != null ? profile.getStatistics().getFollowerCount() : 0)
                .averageRating(profile.getStatistics() != null ? profile.getStatistics().getAverageRating() : 0.0)
                .email(profile.getContact() != null ? profile.getContact().getEmail() : null)
                .phone(profile.getContact() != null ? profile.getContact().getPhone() : null)
                .build();
    }
}
