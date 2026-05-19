package com.flashticket.discovery.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;


/**
 * khi dùng @Async, hệ thống sẽ thực thi hàm đó ở một luồng (thread) khác, giúp luồng chính (xử lý request của người dùng)
 * được giải phóng ngay lập tức mà không cần chờ tác vụ đó xong.
 *
 * */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "asyncExecutor")
    public Executor asyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(5);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("discovery-async-");
        executor.initialize();
        return executor;
    }
}
