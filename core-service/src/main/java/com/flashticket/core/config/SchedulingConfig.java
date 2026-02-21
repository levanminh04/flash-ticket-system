package com.flashticket.core.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Bật @Scheduled cho OrderExpirationService.
 * Tách ra file riêng để dễ disable khi test (mock bean hoặc @TestPropertySource).
 * đặt @EnableScheduling trong CoreServiceApplication  khó disable khi viết unit test
 * @EnableScheduling kích hoạt scheduling infrastructure — bao gồm một ThreadPoolTaskScheduler  nền chuyên chạy các task định kỳ.
 * Spring tìm tất cả methods có @Scheduled trong container → đăng ký vào scheduler. Không cần gọi thủ công ở đâu cả.
 *      T+0s:  App start → scheduler thread pool khởi động
 *      T+60s: Scheduler thread gọi expireOrders()
 *      T+120s: Scheduler thread gọi expireOrders()
 *      ...mãi mãi cho đến khi app tắt
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
