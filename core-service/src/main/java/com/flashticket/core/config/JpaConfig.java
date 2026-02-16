package com.flashticket.core.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Optional;

/**
 * @EnableJpaAuditing ra lệnh cho Spring: "Hãy chú ý đến các field có đánh dấu 
 * @CreatedBy, @LastModifiedBy, @CreatedDate, @LastModifiedDate trong các Entity."
 * Spring biết khi nào dữ liệu thay đổi (thời gian hệ thống), nhưng nó không biết ai (User nào) là người thực hiện.
 * auditorAwareRef = "auditorProvider" ra lệnh cho Spring: "tìm Bean có tên là auditorProvider để lấy thông tin người thực hiện."
 */
@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorProvider")
public class JpaConfig {

    @Bean
    public AuditorAware<String> auditorProvider() {
        return () -> {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            
            if (authentication == null || !authentication.isAuthenticated()) {
                return Optional.of("system");
            }
            
            if (authentication.getPrincipal() instanceof Jwt jwt) {
                String userId = jwt.getClaimAsString("sub");  // Keycloak user ID
                return Optional.ofNullable(userId);
            }
            
            /**
             *         new UsernamePasswordAuthenticationToken(
             *             principalObject,     // principal, có thể là String userID - principal (ai là user)
             *             null,                // credentials, null for JWT
             *             authorities          // roles
             *         );
             */
            return Optional.of("system");
        };
    }
}
