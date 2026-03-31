package com.flashticket.user.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * Cấu hình Thread Pool cho các tác vụ @Async.
 * Tránh việc Spring sử dụng SimpleAsyncTaskExecutor (tạo thread mới liên tục gây OOM).
 *
 * Dùng cho:
 * - @TransactionalEventListener(AFTER_COMMIT) khi cần publish RabbitMQ sau khi DB commit
 * - Các tác vụ async khác (email, stats update)
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "userServiceAsyncExecutor")
    public Executor userServiceAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(20);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("user-async-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(30);
        executor.initialize();
        return executor;
    }
}
    /**
         * Chiến lược khi Pool đầy và Queue cũng đầy:
         * CallerRunsPolicy: Luồng gọi (ví dụ Tomcat thread xử lý IPN) sẽ tự chạy task đó luôn.
         * Điều này tạo ra "back-pressure" tự nhiên, làm chậm luồng nhận request lại một chút
         * thay vì quăng Exception làm mất Task.
         * CallerRunsPolicy — "Tự làm lấy đi"

         Khi nào trigger?
         Core threads: 20/20 đang bận
         Queue:        100/100 đầy
         Task mới đến: không còn chỗ nào
         └─ RejectedExecutionHandler được gọi
    */


/**
 *  executor.setCorePoolSize(10);    // 10 nhân viên cố định
 executor.setQueueCapacity(200);  // hàng chờ 200 chỗ
 executor.setMaxPoolSize(50);     // tối đa 50 nhân viên (thêm 40 thời vụ)
 ```

 **Thứ tự ưu tiên quan trọng:**
 ```
 Task 1-10   → giao cho 10 core threads
 Task 11-210 → xếp vào queue (200 chỗ) ← queue được dùng TRƯỚC khi tạo thêm thread
 Task 211+   → tạo thêm thread thời vụ (lên đến 50)
 Task 261+   → CallerRunsPolicy

 Core thread:    tạo ra → tồn tại mãi mãi dù không có việc làm
 Thread thời vụ: tạo ra → làm xong → idle quá keepAliveTime → tự hủy




 */


