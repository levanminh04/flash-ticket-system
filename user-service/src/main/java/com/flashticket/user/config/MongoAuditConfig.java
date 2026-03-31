package com.flashticket.user.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.mongodb.config.EnableMongoAuditing;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Optional;

/**
 * MongoDB Audit Config — Enable @CreatedDate, @LastModifiedDate, @CreatedBy, @LastModifiedBy.
 * @EnableMongoAuditing tương tự @EnableJpaAuditing
 *
 * AuditorAware: Lấy userId từ JWT token trong SecurityContext để điền vào @CreatedBy/@LastModifiedBy.
 * Khi gọi từ RabbitMQ consumer (không có JWT), trả về "system".
 */
@Configuration
@EnableMongoAuditing(auditorAwareRef = "auditorProvider")
public class MongoAuditConfig {

    @Bean
    public AuditorAware<String> auditorProvider() {
        return () -> {
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated()) {
                return Optional.of("system");
            }
            // JWT principal → lấy sub claim làm userId
            if (auth.getPrincipal() instanceof Jwt jwt) {
                return Optional.ofNullable(jwt.getSubject());
            }
            return Optional.of("system");
        };
    }
}
