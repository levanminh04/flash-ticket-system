package com.flashticket.gateway.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.ReactiveJwtAuthenticationConverterAdapter;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsConfigurationSource;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;
import reactor.core.publisher.Mono;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Vì sao phải dùng @EnableWebFluxSecurity?
 * Vì:
 * MVC security dùng Filter, SecurityFilterChain, @EnableWebSecurity
 * WebFlux security dùng WebFilter,
 * SecurityWebFilterChain, @EnableWebFluxSecurity
 * Gateway chạy trên WebFlux → nên security cũng phải reactive.
 * cố tình thay thế bằng MVC Security, sẽ bị lỗi nghiêm trọng và ứng dụng API
 * Gateway sẽ không thể chạy được.
 */
@Configuration
@EnableWebFluxSecurity
public class SecurityConfig {

    @Bean
    public SecurityWebFilterChain securityWebFilterChain(ServerHttpSecurity http) {
        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .authorizeExchange(exchange -> exchange
                        .pathMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        // Core Service
                        .pathMatchers(HttpMethod.GET, "/api/events/**").permitAll()
                        .pathMatchers(HttpMethod.GET, "/api/categories/**").permitAll()
                        .pathMatchers(HttpMethod.GET, "/api/venues/**").permitAll()

                        // User Service
                        .pathMatchers(HttpMethod.GET, "/api/users/organizers/{organizerId}").permitAll()

                        // AI Service
                        .pathMatchers(HttpMethod.GET, "/api/recommendations/events").permitAll()
                        .pathMatchers(HttpMethod.GET, "/api/recommendations/popular").permitAll()

                        // Infrastructure
                        .pathMatchers("/actuator/health", "/actuator/info").permitAll()
                        .pathMatchers("/eureka/**").permitAll()
                        .pathMatchers("/fallback/**").permitAll()

                        // User Service
                        .pathMatchers("/api/users/admin/**").hasAuthority("ROLE_ADMIN")

                        // Core Service
                        .pathMatchers("/api/admin/**").hasAuthority("ROLE_ADMIN")

                        // AI Service
                        .pathMatchers("/api/analytics/admin/**").hasAuthority("ROLE_ADMIN")

                        // User Service
                        .pathMatchers(HttpMethod.GET, "/api/users/organizers/me").hasAuthority("ROLE_ORGANIZER")
                        .pathMatchers(HttpMethod.PUT, "/api/users/organizers/me").hasAuthority("ROLE_ORGANIZER")

                        // Core Service
                        .pathMatchers("/api/organizer/**").hasAuthority("ROLE_ORGANIZER")

                        // AI Service
                        .pathMatchers("/api/analytics/organizer/**").hasAuthority("ROLE_ORGANIZER")

                        // User Service
                        .pathMatchers(HttpMethod.POST, "/api/users/organizers/register").hasAuthority("ROLE_BUYER")

                        // User Service
                        .pathMatchers(HttpMethod.GET, "/api/users/me").authenticated()
                        .pathMatchers(HttpMethod.PATCH, "/api/users/me").authenticated()

                        // Core Service
                        .pathMatchers("/api/bookings/**").authenticated()
                        .pathMatchers("/api/orders/**").authenticated()
                        .pathMatchers("/api/tickets/**").authenticated()
                        .pathMatchers("/api/payments/**").authenticated()

                        // AI Service
                        .pathMatchers("/api/recommendations/for-you").authenticated()
                        .pathMatchers("/api/analytics/dashboard").authenticated()

                        .anyExchange().authenticated())

                /**
                 * .oauth2ResourceServer(...): biến ứng dụng này thành một Resource Server,
                 * Tác dụng chính của nó là chuyên tiếp nhận, kiểm tra và tự đông bắt và giải mã
                 * Access Token.
                 * tự động chui vào Header của HTTP Request gửi đến Gateway để tìm kiếm chuỗi
                 * Authorization: Bearer <chuỗi_jwt>
                 * Từ khóa oauth2 đầu tiên đại diện cho đối tượng cấu hình của OAuth2 Resource
                 * Server.
                 * .jwt(...) nói cho Spring Security biết Ứng dụng này là OAuth2 Resource Server
                 * và sẽ xác thực request bằng JWT,
                 * biến jwt ở đây đại diện cho đối tượng cấu hình chuyên biệt của JWT.
                 * "Sau khi nhận được JWT, thay vì dùng cách đọc quyền (roles) mặc định của
                 * Spring, hãy dùng cái Converter mà tôi tự viết (jwtAuthenticationConverter())
                 * để lôi quyền từ trong mảng realm_access của Keycloak ra.
                 */
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())))
                // .oauth2ResourceServer(oauth2 -> oauth2
                // .jwt(cauhinhJwt -> cauhinhJwt.jwtAuthenticationConverter(
                // thietLapQuyenTuKeycloak() ))
                // )
                .build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        configuration.setAllowedOrigins(List.of(
                "http://localhost:5173", // Vite dev server
                "http://localhost:3000" // Create React App
        ));

        configuration.setAllowedMethods(List.of(
                "GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));

        configuration.setAllowedHeaders(List.of(
                "Authorization",
                "Content-Type",
                "Accept",
                "X-Requested-With"));

        configuration.setAllowCredentials(true);

        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);

        return source;
    }

    /**
     * JWT Token Structure (from Keycloak):
     * {
     * "sub": "550e8400-e29b-41d4-a716-446655440001",
     * "email": "buyer@flash-ticket.vn",
     * "realm_access": {
     * "roles": ["BUYER", "ORGANIZER", "ADMIN"]
     * }
     * }
     * 
     * Converts to: ROLE_BUYER, ROLE_ORGANIZER, ROLE_ADMIN
     */
    private Converter<Jwt, Mono<AbstractAuthenticationToken>> jwtAuthenticationConverter() {
        JwtAuthenticationConverter jwtAuthenticationConverter = new JwtAuthenticationConverter();
        jwtAuthenticationConverter.setJwtGrantedAuthoritiesConverter(new KeycloakRoleConverter());

        return new ReactiveJwtAuthenticationConverterAdapter(jwtAuthenticationConverter);
    }

    /**
     * 
     * Example Keycloak token claim:
     * "realm_access": {
     * "roles": [
     * "offline_access", // Keycloak default (ignored)
     * "default-roles-flash-ticket", // Keycloak default (ignored)
     * "uma_authorization", // Keycloak default (ignored)
     * "BUYER" // Our business role (extracted)
     * ]
     * }
     */
    static class KeycloakRoleConverter implements Converter<Jwt, Collection<GrantedAuthority>> {

        @Override
        public Collection<GrantedAuthority> convert(Jwt jwt) {

            Map<String, Object> realmAccess = jwt.getClaim("realm_access");

            if (realmAccess == null || !realmAccess.containsKey("roles")) {
                return List.of();
            }

            @SuppressWarnings("unchecked")
            List<String> roles = (List<String>) realmAccess.get("roles");

            return roles.stream()
                    .filter(role -> role.equals("BUYER") ||
                            role.equals("ORGANIZER") ||
                            role.equals("ADMIN"))
                    .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                    .collect(Collectors.toList());
        }
    }
}