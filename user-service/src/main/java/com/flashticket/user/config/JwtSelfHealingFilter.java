package com.flashticket.user.config;

import com.flashticket.user.model.User;
import com.flashticket.user.model.UserRole;
import com.flashticket.user.model.UserStatus;
import com.flashticket.user.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * Self-Healing JWT Filter — CƠ CHẾ 2 (Lazy/Auto Sync).
 *
 * Lớp phòng vệ dự phòng khi RabbitMQ SPI bị lỗi/lag:
 *   1. Với mỗi request có JWT hợp lệ, lấy sub (userId) từ JWT.
 *   2. Nếu userId này chưa có trong MongoDB → tự động tạo mới (on-the-fly).
 *   3. Nếu email trong JWT khác với MongoDB → tự động cập nhật (email sync).
 *
 * Tại sao cần lớp này nếu đã có RabbitMQ?
 *   - RabbitMQ SPI có thể bị lag, fail, hay chưa được cài đặt trong môi trường dev.
 *   - User đăng ký qua social login (Google) — Keycloak tạo nhưng SPI có thể không phát event.
 *   - Đây là safety net đảm bảo user LUÔN có trong MongoDB sau lần login đầu tiên.
 *
 * Performance: Filter chỉ query MongoDB 1 lần, kết quả được cache bởi connection pool.
 *              Không làm chậm request đáng kể.
 *
 * @Order(1) — Chạy SAU Spring Security filter chain (Spring Security ở order LOWEST_PRECEDENCE - 100).
 *             Filter này cần JWT đã được parse xong.
 */
@Component
@Order(1)
@RequiredArgsConstructor
@Slf4j
public class JwtSelfHealingFilter extends OncePerRequestFilter {
// OncePerRequestFilter tạo custom filter, tạo ra một mắt xích mới để chèn vào cái "xích xe đạp" (Filter Chain) của ứng dụng. đảm bảo một filter chỉ được thực thi duy nhất một lần cho mỗi request gửi đến server.

    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        try {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();

            // Chỉ xử lý khi đã authenticated và principal là JWT
            if (auth != null && auth.isAuthenticated()
                    && auth.getPrincipal() instanceof Jwt jwt) {

                String userId = jwt.getSubject();
                String email  = jwt.getClaimAsString("email");

                if (userId != null && email != null) {
                    ensureUserExists(userId, email, jwt);
                }
            }
        } catch (Exception ex) {
            // KHÔNG throw exception — filter này là optional safety net, không được chặn request
            log.warn("[Self-Healing] Failed to sync user from JWT: {}", ex.getMessage());
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Đảm bảo user tồn tại trong MongoDB, sync email nếu lệch.
     */
    private void ensureUserExists(String userId, String email, Jwt jwt) {
        userRepository.findById(userId).ifPresentOrElse(
            existingUser -> {
                // Check email sync — Keycloak là SSOT
                if (!email.equals(existingUser.getEmail())) {
                    log.warn("[Self-Healing] Email mismatch for user {} — updating MongoDB: {} → {}",
                             userId, existingUser.getEmail(), email);
                    existingUser.setEmail(email);
                    existingUser.setEmailVerified(Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified")));
                    userRepository.save(existingUser);
                }
            },
            () -> {
                // User chưa có → tạo mới (RabbitMQ bị miss)
                log.info("[Self-Healing] User not found in MongoDB → creating: id={}, email={}", userId, email);

                List<UserRole> roles = extractRoles(jwt);

                User newUser = User.builder()
                        .id(userId)
                        .keycloakId(userId)
                        .email(email)
                        .emailVerified(Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified")))
                        .profile(User.Profile.builder()
                                .firstName(jwt.getClaimAsString("given_name"))
                                .lastName(jwt.getClaimAsString("family_name"))
                                .displayName(buildDisplayName(
                                        jwt.getClaimAsString("given_name"),
                                        jwt.getClaimAsString("family_name")))
                                .build())
                        .roles(roles)
                        .status(UserStatus.ACTIVE)
                        .loginCount(0)
                        .isDeleted(false)
                        .build();

                userRepository.save(newUser);
                log.info("[Self-Healing] Created user via JWT Self-Healing: {}", userId);
            }
        );
    }

    @SuppressWarnings("unchecked")
    private List<UserRole> extractRoles(Jwt jwt) {
        try {
            Map<String, Object> realmAccess = jwt.getClaim("realm_access");
            if (realmAccess == null) return List.of(UserRole.BUYER);

            List<String> rawRoles = (List<String>) realmAccess.get("roles");
            if (rawRoles == null || rawRoles.isEmpty()) return List.of(UserRole.BUYER);

            return rawRoles.stream()
                    .filter(r -> r.equals("BUYER") || r.equals("ORGANIZER") || r.equals("ADMIN"))
                    .map(r -> UserRole.valueOf(r.toUpperCase()))
                    .toList();
        } catch (Exception ex) {
            log.warn("[Self-Healing] Failed to extract roles from JWT, defaulting to BUYER");
            return List.of(UserRole.BUYER);
        }
    }

    private String buildDisplayName(String firstName, String lastName) {
        if (firstName == null && lastName == null) return null;
        if (firstName == null) return lastName;
        if (lastName == null) return firstName;
        return lastName + " " + firstName;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Bỏ qua actuator endpoints và internal sync endpoints
        String path = request.getRequestURI();
        return path.startsWith("/actuator") || path.startsWith("/api/internal");
    }
}
