package com.flashticket.user.sync;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.flashticket.user.model.User;
import com.flashticket.user.model.UserRole;
import com.flashticket.user.model.UserStatus;
import com.flashticket.user.repository.UserRepository;
import com.rabbitmq.client.Channel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.flashticket.user.shared.messaging.RabbitMQConstants.QUEUE_USER_SYNC;

/**
 * Keycloak Event Consumer — CÁC H 1 (RabbitMQ SPI Sync).
 *
 * Lắng nghe queue q.keycloak.user.sync để nhận các sự kiện từ Keycloak SPI:
 *   - user.register → Insert user mới vào MongoDB
 *   - user.update   → Update email/profile nếu thay đổi
 *   - user.delete   → Soft-delete user trong MongoDB
 *
 * MANUAL ACK để đảm bảo message không bị mất nếu xử lý lỗi.
 * Idempotent: Dùng findByKeycloakId + upsert pattern, cho phép retry an toàn.
 *
 * Payload format mà Keycloak Event Listener SPI gửi ra (cần cấu hình SPI khớp):
 * {
 *   "type": "REGISTER" | "UPDATE_PROFILE" | "UPDATE_EMAIL" | "DELETE_ACCOUNT",
 *   "userId": "uuid-from-keycloak",
 *   "email": "user@example.com",
 *   "firstName": "Nguyen",
 *   "lastName": "Van A",
 *   "roles": ["BUYER"]
 * }
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class KeycloakEventConsumer {

    private final UserRepository userRepository;

    @RabbitListener(queues = QUEUE_USER_SYNC)
    public void onKeycloakEvent(
            @Payload CloudEvent cloudEvent,
            @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag,
            Channel channel) throws IOException {

        log.info("[Keycloak Sync] Received event: eventId={}, eventType={}, source={}", 
                 cloudEvent.eventId(), cloudEvent.eventType(), cloudEvent.source());

        KeycloakUserEvent payload = cloudEvent.payload();
        if (payload == null || payload.userId() == null) {
            log.error("[Keycloak Sync] Invalid CloudEvent payload: {}", cloudEvent);
            channel.basicAck(deliveryTag, false);
            return;
        }

        try {
            switch (cloudEvent.eventType()) {
                case "USER_REGISTER", "ADMIN_USER_CREATE" -> handleRegister(payload);
                case "USER_UPDATE_PROFILE", "USER_UPDATE_EMAIL", "ADMIN_USER_UPDATE" -> handleUpdate(payload);
                case "USER_DELETE_ACCOUNT", "ADMIN_USER_DELETE" -> handleDelete(payload);
                default -> log.debug("[Keycloak Sync] Ignoring unhandled eventType: {}", cloudEvent.eventType());
            }
            channel.basicAck(deliveryTag, false);
        } catch (Exception ex) {
            log.error("[Keycloak Sync] Processing failed for eventType={}, userId={}: {}",
                      cloudEvent.eventType(), payload.userId(), ex.getMessage());
            channel.basicNack(deliveryTag, false, false);
        }
    }

    // ── Handlers ─────────────────────────────────────────────────────────────

    private void handleRegister(KeycloakUserEvent event) {
        if (userRepository.existsByKeycloakId(event.userId())) {
            log.warn("[Keycloak Sync] User already exists (idempotent skip): {}", event.userId());
            return;
        }

        // Ưu tiên role từ trường 'roles' chuyên biệt trong payload
        List<UserRole> roles = (event.roles() != null && !event.roles().isEmpty())
                ? event.roles().stream()
                       .filter(r -> {
                           try {
                               UserRole.valueOf(r.toUpperCase());
                               return true;
                           } catch (Exception e) {
                               return false;
                           }
                       })
                       .map(r -> UserRole.valueOf(r.toUpperCase()))
                       .toList()
                : List.of(UserRole.BUYER);

        User newUser = User.builder()
                .id(event.userId())           
                .keycloakId(event.userId())
                .email(event.email())
                .emailVerified(Boolean.TRUE.equals(event.emailVerified()))
                .profile(User.Profile.builder()
                        .firstName(event.firstName())
                        .lastName(event.lastName())
                        .displayName(buildDisplayName(event.firstName(), event.lastName()))
                        .build())
                .roles(roles)
                .status(UserStatus.ACTIVE)
                .loginCount(0)
                .isDeleted(false)
                .build();

        userRepository.save(newUser);
        log.info("[Keycloak Sync] Created new user: id={}, email={}, roles={}", 
                 event.userId(), event.email(), roles);
    }

    private void handleUpdate(KeycloakUserEvent event) {
        Optional<User> existing = userRepository.findByKeycloakId(event.userId());

        if (existing.isEmpty()) {
            log.warn("[Keycloak Sync] UPDATE received but user not found → creating: {}", event.userId());
            handleRegister(event);
            return;
        }

        User user = existing.get();
        boolean changed = false;

        if (event.email() != null && !event.email().equals(user.getEmail())) {
            user.setEmail(event.email());
            changed = true;
        }
        if (event.emailVerified() != null && !event.emailVerified().equals(user.getEmailVerified())) {
            user.setEmailVerified(event.emailVerified());
            changed = true;
        }

        if (event.firstName() != null || event.lastName() != null) {
            User.Profile profile = user.getProfile() != null ? user.getProfile() : new User.Profile();
            if (event.firstName() != null) profile.setFirstName(event.firstName());
            if (event.lastName() != null) profile.setLastName(event.lastName());
            profile.setDisplayName(buildDisplayName(profile.getFirstName(), profile.getLastName()));
            user.setProfile(profile);
            changed = true;
        }

        // Đồng bộ hóa Role nếu có thay đổi từ Keycloak (Admin gán role)
        if (event.roles() != null && !event.roles().isEmpty()) {
            List<UserRole> newRoles = event.roles().stream()
                    .filter(r -> {
                        try {
                            UserRole.valueOf(r.toUpperCase());
                            return true;
                        } catch (Exception e) {
                            return false;
                        }
                    })
                    .map(r -> UserRole.valueOf(r.toUpperCase()))
                    .toList();
            
            if (!newRoles.isEmpty() && !newRoles.equals(user.getRoles())) {
                log.info("[Keycloak Sync] Roles updated for user {}: {}", event.userId(), newRoles);
                user.setRoles(newRoles);
                changed = true;
            }
        }

        if (changed) {
            userRepository.save(user);
            log.info("[Keycloak Sync] Updated user: {}", event.userId());
        }
    }

    private void handleDelete(KeycloakUserEvent event) {
        userRepository.findByKeycloakId(event.userId()).ifPresentOrElse(user -> {
            user.setIsDeleted(true);
            user.setStatus(UserStatus.INACTIVE);
            userRepository.save(user);
            log.info("[Keycloak Sync] Soft-deleted user: {}", event.userId());
        }, () -> log.warn("[Keycloak Sync] DELETE received for unknown user: {}", event.userId()));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String buildDisplayName(String firstName, String lastName) {
        if (firstName == null && lastName == null) return null;
        if (firstName == null) return lastName;
        if (lastName == null) return firstName;
        return lastName + " " + firstName;
    }

    // ── Message DTO ───────────────────────────────────────────────────────────

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CloudEvent(
            String eventId,
            String eventType,
            long timestamp,
            String source,
            Map<String, Object> metadata,
            KeycloakUserEvent payload
    ) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record KeycloakUserEvent(
            String userId,
            String email,
            Boolean emailVerified,
            String firstName,
            String lastName,
            List<String> roles,
            Map<String, List<String>> attributes
    ) {}

}
