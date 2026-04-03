package com.flashticket.user.config.properties;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Type-safe configuration cho Keycloak Admin API.
 *
 * Map từ configserver/user-service.yml:
 *   keycloak.admin.server-url
 *   keycloak.admin.realm
 *   keycloak.admin.client-id
 *   keycloak.admin.client-secret
 *
 * Dùng record: immutable, tự generate constructor/getter/toString.
 * @Validated: Spring validate @NotBlank khi application startup.
 *   → Nếu thiếu config, app sẽ fail-fast thay vì NullPointerException lúc runtime.
 */
@ConfigurationProperties(prefix = "keycloak.admin")
@Validated
public record KeycloakAdminProperties(
        @NotBlank String serverUrl,
        @NotBlank String realm,
        @NotBlank String clientId,
        @NotBlank String clientSecret
) {}
