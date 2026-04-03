package com.flashticket.user.service;

import com.flashticket.user.common.exception.InvalidRequestException;
import com.flashticket.user.config.properties.KeycloakAdminProperties;
import com.flashticket.user.dto.UserRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Keycloak Admin REST API Client.
 *
 * Chức năng:
 *   - assignRoleToUser(): Gán role ORGANIZER khi Admin duyệt KYC (duy nhất nơi thực sự cần gọi).
 *   - disableUser():      Khóa tài khoản user vi phạm.
 *   - createUser():       Tạo user trực tiếp trong Keycloak (legacy, giữ làm tài liệu).
 *   - getServiceAccountToken(): Lấy token qua Client Credentials Flow.
 *
 * Refactored từ bản cũ:
 *   - RestTemplate → RestClient (Spring 6.1+, nhất quán với core-service UserServiceClient).
 *   - @Value rời rạc → @ConfigurationProperties (type-safe, fail-fast).
 *   - RuntimeException → Custom exceptions (proper error handling).
 *
 * Auth Strategy:
 *   Sử dụng Client Credentials Flow (Service Account) thay vì admin username/password.
 *   → An toàn hơn vì không cần lưu trữ mật khẩu admin trong config.
 *   → Service account chỉ có permission đã được cấu hình trong Keycloak.
 */
@Service
@Slf4j
public class KeycloakAdminService {

    private final KeycloakAdminProperties keycloakProperties;
    private final RestClient restClient;

    public KeycloakAdminService(KeycloakAdminProperties keycloakProperties) {
        this.keycloakProperties = keycloakProperties;
        this.restClient = RestClient.builder()
                .baseUrl(keycloakProperties.serverUrl())
                .build();
    }

    // ═══════════════════════════════════════════════════════
    // PUBLIC API — Các method thực sự được dùng trong luồng nghiệp vụ
    // ═══════════════════════════════════════════════════════

    /**
     * Gán realm role cho user trong Keycloak.
     *
     * Use case chính: Admin duyệt KYC → gán role ORGANIZER.
     * Sau khi gán, JWT của user sẽ có role mới trong lần login/refresh tiếp theo.
     *
     * @param userId   Keycloak user UUID (= MongoDB _id)
     * @param roleName Tên role cần gán (VD: "ORGANIZER")
     * @throws InvalidRequestException nếu Keycloak API trả lỗi
     */
    public void assignRoleToUser(String userId, String roleName) {
        log.info("[Keycloak Admin] Assigning role '{}' to user '{}'", roleName, userId);

        String token = getServiceAccountToken();

        // Bước 1: Lấy role representation từ realm roles
        Map<String, Object> roleRepresentation = getRealmRoleRepresentation(token, roleName);

        // Bước 2: Gán role cho user
        try {
            restClient.post() // .baseUrl() đã được build ở trên (trong constructor)
                    .uri("/admin/realms/{realm}/users/{userId}/role-mappings/realm",
                            keycloakProperties.realm(), userId) // restClient tự động binding vào {realm} và {userId}
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(List.of(roleRepresentation))
                    .retrieve()
                    .toBodilessEntity();

            log.info("[Keycloak Admin] Successfully assigned role '{}' to user '{}'", roleName, userId);
        } catch (RestClientResponseException ex) {
            log.error("[Keycloak Admin] Failed to assign role '{}' to user '{}': {} {}",
                    roleName, userId, ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new InvalidRequestException(
                    "Keycloak: Failed to assign role " + roleName + " — " + ex.getStatusCode());
        }
    }

    /**
     * Vô hiệu hóa tài khoản user trong Keycloak.
     * User đã bị disable sẽ không thể login hoặc refresh token.
     *
     * @param userId Keycloak user UUID
     */
    public void disableUser(String userId) {
        log.warn("[Keycloak Admin] Disabling user: {}", userId);

        String token = getServiceAccountToken();

        try {
            restClient.put()
                    .uri("/admin/realms/{realm}/users/{userId}",
                            keycloakProperties.realm(), userId)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("enabled", false))
                    .retrieve()
                    .toBodilessEntity();

            log.info("[Keycloak Admin] Successfully disabled user: {}", userId);
        } catch (RestClientResponseException ex) {
            log.error("[Keycloak Admin] Failed to disable user '{}': {} {}",
                    userId, ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new InvalidRequestException(
                    "Keycloak: Failed to disable user — " + ex.getStatusCode());
        }
    }

    // ═══════════════════════════════════════════════════════
    // LEGACY METHODS — Giữ lại làm tài liệu tham khảo
    // Trong kiến trúc hiện tại, Keycloak tự xử lý đăng ký user qua frontend.
    // User Service chỉ lắng nghe event đồng bộ (RabbitMQ SPI / Self-Healing).
    // ═══════════════════════════════════════════════════════

    /**
     * [LEGACY] Lấy Admin Access Token qua Client Credentials Flow.
     *
     * Phiên bản cũ dùng Password Flow (admin username/password).
     * Phiên bản mới dùng Client Credentials Flow (client_id/client_secret).
     *
     * Lưu ý: Method này nay là wrapper cho getServiceAccountToken().
     * Giữ lại tên cũ để không break các chỗ tham chiếu (nếu có).
     */
    public String getAdminAccessToken() {
        return getServiceAccountToken();
    }

    /**
     * [LEGACY] Tạo user mới trực tiếp trong Keycloak qua Admin REST API.
     *
     * Trong kiến trúc hiện tại, flow đăng ký:
     *   1. User đăng ký qua Keycloak frontend → Keycloak tạo user.
     *   2. Keycloak SPI phát event → RabbitMQ → KeycloakEventConsumer sync vào MongoDB.
     *   3. Nếu SPI miss → JwtSelfHealingFilter tự tạo user khi login lần đầu.
     *
     * Method này giữ lại cho trường hợp Admin tạo user từ backend (bulk import).
     *
     * @param token       Admin access token
     * @param userRequest Thông tin user cần tạo
     * @return Keycloak user ID (UUID string)
     */
    public String createUser(String token, UserRequest userRequest) {
        log.info("[Keycloak Admin] Creating user: {}", userRequest.getEmail());

        Map<String, Object> userPayload = new HashMap<>();
        userPayload.put("username", userRequest.getUsername());
        userPayload.put("email", userRequest.getEmail());
        userPayload.put("enabled", true);
        userPayload.put("firstName", userRequest.getFirstName());
        userPayload.put("lastName", userRequest.getLastName());

        Map<String, Object> credential = new HashMap<>();
        credential.put("type", "password");
        credential.put("value", userRequest.getPassword());
        credential.put("temporary", false);

        userPayload.put("credentials", List.of(credential));

        try {
            ResponseEntity<Void> response = restClient.post()
                    .uri("/admin/realms/{realm}/users", keycloakProperties.realm())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(userPayload)
                    .retrieve()
                    .toBodilessEntity();

            // Extract Keycloak user ID từ Location header
            URI location = response.getHeaders().getLocation();
            if (location == null) {
                throw new InvalidRequestException("Keycloak did not return Location header after user creation");
            }

            String path = location.getPath();
            String keycloakUserId = path.substring(path.lastIndexOf("/") + 1);

            log.info("[Keycloak Admin] Created user in Keycloak: id={}, email={}",
                    keycloakUserId, userRequest.getEmail());
            return keycloakUserId;

        } catch (RestClientResponseException ex) {
            log.error("[Keycloak Admin] Failed to create user '{}': {} {}",
                    userRequest.getEmail(), ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new InvalidRequestException(
                    "Keycloak: Failed to create user — " + ex.getStatusCode());
        }
    }

    // ═══════════════════════════════════════════════════════
    // INTERNAL HELPERS
    // ═══════════════════════════════════════════════════════

    /**
     * Lấy Service Account Token qua Client Credentials Flow.
     *
     * Client Credentials Flow:
     *   POST /realms/{realm}/protocol/openid-connect/token
     *   grant_type=client_credentials
     *   client_id=user-service
     *   client_secret=xxx
     *
     * Keycloak sẽ kiểm tra Service Account Roles của client "user-service"
     * để quyết định token này có quyền gì (manage-users, manage-realm, etc.).
     */
    @SuppressWarnings("unchecked")
    private String getServiceAccountToken() {
        MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
        params.add("grant_type", "client_credentials");
        params.add("client_id", keycloakProperties.clientId());
        params.add("client_secret", keycloakProperties.clientSecret());

        try {
            Map<String, Object> response = restClient.post()
                    .uri("/realms/{realm}/protocol/openid-connect/token",
                            keycloakProperties.realm())
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(params)
                    .retrieve()
                    .body(Map.class);

            if (response == null || !response.containsKey("access_token")) {
                throw new InvalidRequestException(
                        "Keycloak: Token response missing access_token");
            }

            return (String) response.get("access_token");
        } catch (RestClientResponseException ex) {
            log.error("[Keycloak Admin] Failed to obtain service account token: {} {}",
                    ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new InvalidRequestException(
                    "Keycloak: Failed to obtain service account token — " + ex.getStatusCode());
        }
    }

    /**
     * Lấy Realm Role Representation object từ Keycloak. Trong Keycloak, mỗi Role không chỉ đơn thuần là một cái tên (String).
     * Nó là một Đối tượng (Object) đầy đủ với các thông tin định danh duy nhất.
     * Một "Role Representation" thông thường sẽ có cấu trúc JSON như thế này:
     * {
     *   "id": "f5e9-4a3b-9c2d...",  // Đây là ID thực sự của bản ghi trong Keycloak DB
     *   "name": "ORGANIZER",        // Tên chúng ta hay gọi
     *   "description": "...",
     *   "composite": false,
     *   "clientRole": false,
     *   "containerId": "flash-ticket"
     * }
     * Keycloak API yêu cầu gửi full role object khi gán role, không chỉ tên role.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> getRealmRoleRepresentation(String token, String roleName) {
        try {
            return restClient.get()
                    .uri("/admin/realms/{realm}/roles/{roleName}",
                            keycloakProperties.realm(), roleName)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                    .retrieve()
                    .body(Map.class);
        } catch (RestClientResponseException ex) {
            log.error("[Keycloak Admin] Failed to fetch role '{}': {} {}",
                    roleName, ex.getStatusCode(), ex.getResponseBodyAsString());
            throw new InvalidRequestException(
                    "Keycloak: Role '" + roleName + "' not found — " + ex.getStatusCode());
        }
    }
}
