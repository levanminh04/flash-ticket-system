package com.flashticket.core.config;

import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.Config;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RedissonConfig — cấu hình Redis Distributed Lock client.
 *
 * Redisson được dùng để:
 * 1. Chống race condition khi nhiều user cùng mua vé (TicketReservationService)
 * 2. Distributed lock an toàn trong môi trường multi-instance
 *
 * Lưu ý: Redisson KHÔNG thay thế Spring Data Redis (nếu có).
 * Hai thư viện có thể cùng tồn tại — Redisson chuyên về distributed locks/structures.
 * Redisson là thư viện Redis client cao cấp cho Java, giúp làm việc với Redis theo phong cách lập trình hướng đối tượng
 * (như sử dụng RLock, RMap, RQueue) thay vì thao tác các lệnh Redis thô.
 */
@Configuration
public class RedissonConfig {

    @Value("${spring.data.redis.host:localhost}")
    private String redisHost;

    @Value("${spring.data.redis.port:6379}")
    private int redisPort;

    @Value("${spring.data.redis.password:}")
    private String redisPassword;

    @Bean(destroyMethod = "shutdown") // Khi ứng dụng Spring Boot dừng lại (stop/shutdown), Spring sẽ tự động gọi phương thức .shutdown() của RedissonClient để đóng tất cả các kết nối đến Redis một cách an toàn, tránh rò rỉ tài nguyên.
    public RedissonClient redissonClient() {
        Config config = new Config();

        String address = "redis://" + redisHost + ":" + redisPort;
        var singleServer = config.useSingleServer() // kết nối tới một máy chủ Redis đơn lẻ (không phải cụm Cluster hay Sentinel).
            .setAddress(address)
            .setConnectionMinimumIdleSize(10) // Số lượng kết nối tối thiểu luôn được duy trì ở trạng thái rảnh (idle). Giúp giảm độ trễ khi có request mới vì không phải khởi tạo kết nối từ đầu.
            .setConnectionPoolSize(60) // Số lượng kết nối tối đa mà Redisson có thể tạo ra. Redis là hệ thống Single-threaded (xét trên lõi xử lý lệnh). Nghĩa là tại một thời điểm, Redis chỉ thực hiện duy nhất một lệnh. Khi bạn dùng Redisson Lock: , các lệnh vẫn được xếp hàng để xử lý tuần tự. Điều này đảm bảo tính Atomic (nguyên tử), giúp loại bỏ hoàn toàn Race Condition.
            .setConnectTimeout(3000) // Nếu quá thời gian này mà không kết nối được, nó sẽ ném ra ngoại lệ.
            .setRetryAttempts(3) // Nếu một lệnh gửi đến Redis bị thất bại do lỗi mạng hoặc timeout, Redisson sẽ thử gửi lại 3 lần nữa trước khi bỏ cuộc.
            .setRetryInterval(1500); // Khoảng thời gian chờ giữa các lần thử lại là 1.5 giây.

        if (redisPassword != null && !redisPassword.isBlank()) {
            singleServer.setPassword(redisPassword);
        }

        return Redisson.create(config);
    }
}
