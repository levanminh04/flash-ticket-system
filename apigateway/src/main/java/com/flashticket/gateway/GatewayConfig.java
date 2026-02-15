package com.flashticket.gateway;


import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.cloud.gateway.filter.ratelimit.RedisRateLimiter;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import reactor.core.publisher.Mono;

/**
 * khi một request gửi đến: SecurityConfig sẽ chạy TRƯỚC, sau đó mới đến GatewayConfig.
 *
 * */

@Configuration
public class GatewayConfig {


    /**
     * Cần có server redis riêng, nếu không cấu hình, spring sẽ tự động tạo server redis tại địa chỉ localhost:6379.
     * */
    @Bean
    public RedisRateLimiter redisRateLimiter() {
        return new RedisRateLimiter(10,20,1);
    }

    /**
     * dùng HostName / IP Address của người gửi. Nghĩa là quy tắc 10 request/giây ở trên được áp dụng cho từng IP riêng biệt, 
     * giúp chống lại các cuộc tấn công DDoS hoặc spam request từ một nguồn duy nhất.
     * */
    @Bean
    public KeyResolver hostNameKeyResolver() {
        return exchange -> Mono.just(
                exchange.getRequest().getRemoteAddress().getHostName());
    }

    @Bean
    public RouteLocator customRouteLocator(RouteLocatorBuilder builder) {
        return builder.routes()
                // Core Service - Events, Bookings, Payments, Categories
                .route("core-service", r -> r
                        .path("/api/events/**", "/api/bookings/**", "/api/payments/**", 
                              "/api/categories/**", "/api/organizer/**", "/api/admin/**")
                        .filters(f -> f
                                .retry(retryConfig -> retryConfig
                                        .setRetries(3)
                                        .setMethods(HttpMethod.GET)
                                )
                                .requestRateLimiter(config -> config
                                        .setRateLimiter(redisRateLimiter())
                                        .setKeyResolver(hostNameKeyResolver())
                                )
                                .circuitBreaker(config -> config
                                        .setName("coreServiceBreaker")
                                        .setFallbackUri("forward:/fallback/core")
                                )
                        )
                        .uri("lb://CORE-SERVICE")
                )
                
                // User Service - User profiles, authentication
                .route("user-service", r -> r
                        .path("/api/users/**")
                        .filters(f -> f
                                .circuitBreaker(config -> config
                                        .setName("userServiceBreaker")
                                        .setFallbackUri("forward:/fallback/user")
                                )
                        )
                        .uri("lb://USER-SERVICE")
                )
                
                // AI Service - Recommendations, Analytics
                .route("ai-service", r -> r
                        .path("/api/recommendations/**", "/api/analytics/**")
                        .filters(f -> f
                                .circuitBreaker(config -> config
                                        .setName("aiServiceBreaker")
                                        .setFallbackUri("forward:/fallback/ai")
                                )
                        )
                        .uri("lb://AI-SERVICE")
                )
                
                // Eureka Dashboard (for development)
                .route("eureka-server", r -> r
                        .path("/eureka/main")
                        .filters(f -> f.rewritePath("/eureka/main", "/"))
                        .uri("http://localhost:8761")
                )
                .route("eureka-server-static", r -> r
                        .path("/eureka/**")
                        .uri("http://localhost:8761")
                )
                
                .build();
    }
}
