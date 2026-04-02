package com.flashticket.user.service;

import com.flashticket.user.common.exception.ResourceNotFoundException;
import com.flashticket.user.dto.UpdateProfileRequest;
import com.flashticket.user.dto.UserResponse;
import com.flashticket.user.model.User;
import com.flashticket.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * User Profile Service.
 *
 * Responsibilities:
 *   - getMe: Lấy profile hiện tại từ MongoDB.
 *   - updateProfile: Cập nhật thông tin cá nhân (Partial Update).
 *
 * Nguyên tắc:
 *   - IDOR Protection: userId luôn lấy từ JWT, không từ request body.
 *   - Email do Keycloak quản lý — KHÔNG cho phép update qua API này.
 *   - Chỉ save khi có field thay đổi (tránh dirty updatedAt — AI_CONTEXT Bug avoidance).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class UserService {

    private final UserRepository userRepository;

    // ═══════════════════════════════════════════════════════
    // READ
    // ═══════════════════════════════════════════════════════

    /**
     * Lấy profile của user hiện tại.
     * Self-Healing Filter đã đảm bảo user luôn tồn tại trong MongoDB
     * trước khi request đến đây. Tuy nhiên vẫn phải handle case not found
     * (defense in depth — phòng trường hợp filter bị skip).
     */
    public UserResponse getMe(String userId) {
        log.debug("Fetching profile for user: {}", userId);

        User user = findUserOrThrow(userId);
        return UserResponse.from(user);
    }

    // ═══════════════════════════════════════════════════════
    // UPDATE
    // ═══════════════════════════════════════════════════════

    /**
     * Cập nhật thông tin cá nhân user (Partial Update).
     *
     * Chỉ update field nào client gửi lên (không null).
     * Kiểm tra có thay đổi thật sự trước khi save để tránh dirty updatedAt.
     */
    public UserResponse updateProfile(String userId, UpdateProfileRequest req) {
        log.info("Updating profile for user: {}", userId);

        User user = findUserOrThrow(userId);
        boolean changed = false;

        // ── Profile fields ────────────────────────────────────────────────
        User.Profile profile = user.getProfile();
        if (profile == null) {
            profile = new User.Profile();
            user.setProfile(profile);
        }

        if (req.firstName() != null && !req.firstName().equals(profile.getFirstName())) {
            profile.setFirstName(req.firstName());
            changed = true;
        }
        if (req.lastName() != null && !req.lastName().equals(profile.getLastName())) {
            profile.setLastName(req.lastName());
            changed = true;
        }
        if (req.displayName() != null && !req.displayName().equals(profile.getDisplayName())) {
            profile.setDisplayName(req.displayName());
            changed = true;
        }
        if (req.bio() != null && !req.bio().equals(profile.getBio())) {
            profile.setBio(req.bio());
            changed = true;
        }
        if (req.dateOfBirth() != null && !req.dateOfBirth().equals(profile.getDateOfBirth())) {
            profile.setDateOfBirth(req.dateOfBirth());
            changed = true;
        }
        if (req.gender() != null) {
            User.Gender newGender = User.Gender.fromString(req.gender());
            if (!newGender.equals(profile.getGender())) {
                profile.setGender(newGender);
                changed = true;
            }
        }

        // Auto-compute displayName nếu user không set custom
        if (changed && !StringUtils.hasText(req.displayName())) {
            String computed = buildDisplayName(profile.getFirstName(), profile.getLastName());
            if (computed != null) {
                profile.setDisplayName(computed);
            }
        }

        // ── Phone (nằm ngoài profile, trực tiếp trên User) ───────────────
        if (req.phone() != null && !req.phone().equals(user.getPhone())) {
            user.setPhone(req.phone());
            user.setPhoneVerified(false); // Đổi phone → cần verify lại
            changed = true;
        }

        // ── Save nếu có thay đổi ─────────────────────────────────────────
        if (changed) {
            user = userRepository.save(user);
            log.info("Profile updated for user: {}", userId);
        } else {
            log.debug("No changes detected for user: {}", userId);
        }

        return UserResponse.from(user);
    }

    // ═══════════════════════════════════════════════════════
    // INTERNAL HELPERS — Dùng chung cho các service khác trong package
    // ═══════════════════════════════════════════════════════

    /**
     * Tìm user hoặc throw 404.
     * Package-private để OrganizerService có thể dùng.
     */
    User findUserOrThrow(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", "id", userId));
    }

    private String buildDisplayName(String firstName, String lastName) {
        if (firstName == null && lastName == null) return null;
        if (firstName == null) return lastName;
        if (lastName == null) return firstName;
        return lastName + " " + firstName; // Việt Nam: Họ trước Tên
    }

    // ═══════════════════════════════════════════════════════
    // AVATAR
    // ═══════════════════════════════════════════════════════

    /**
     * Upload và cập nhật Avatar.
     * Cũ: Nếu có avatar cũ thì nên xóa trên Cloudinary để tiết kiệm dung lượng (Optional).
     * Hiện tại: Cloudinary cấu hình override nếu cùng public_id, nhưng ta đang random UUID.
     * Tạm thời append mới, update URL trong DB.
     * 
     * @param userId 
     * @param avatarUrl URL sau khi Upload thành công
     * @return UserResponse
     */
    public UserResponse updateAvatarUrl(String userId, String avatarUrl) {
        log.info("Updating avatar for user: {}", userId);

        User user = findUserOrThrow(userId);

        User.Profile profile = user.getProfile();
        if (profile == null) {
            profile = new User.Profile();
            user.setProfile(profile);
        }

        profile.setAvatarUrl(avatarUrl);
        user = userRepository.save(user);

        return UserResponse.from(user);
    }
}
