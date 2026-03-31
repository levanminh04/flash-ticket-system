package com.flashticket.core.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

/**
 * Cấu hình Thread Pool cho các tác vụ @Async.
 * Tránh việc Spring sử dụng SimpleAsyncTaskExecutor (tạo thread mới liên tục gây OOM).
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "paymentAsyncExecutor")
    public Executor paymentAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        
        // Số lượng thread tối thiểu luôn duy trì
        executor.setCorePoolSize(10);
        
        // Số lượng thread tối đa khi queue đầy
        executor.setMaxPoolSize(50);
        
        // Sức chứa của hàng đợi trước khi tạo thêm thread mới (đến max)
        executor.setQueueCapacity(1000);
        
        // Tiền tố tên thread để dễ debug trong log
        executor.setThreadNamePrefix("async-exec-");
        
        /**
         * Chiến lược khi Pool đầy và Queue cũng đầy:
         * CallerRunsPolicy: Luồng gọi (ví dụ Tomcat thread xử lý IPN) sẽ tự chạy task đó luôn.
         * Điều này tạo ra "back-pressure" tự nhiên, làm chậm luồng nhận request lại một chút
         * thay vì quăng Exception làm mất Task.
         * CallerRunsPolicy — "Tự làm lấy đi"

            Khi nào trigger?
            Core threads: 50/50 đang bận
            Queue:        1000/1000 đầy
            Task mới đến: không còn chỗ nào
                └─ RejectedExecutionHandler được gọi
         */
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        
        // Đợi các task hoàn thành khi shutdown app (graceful shutdown)
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        
        executor.initialize();
        return executor;
    }
}

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
