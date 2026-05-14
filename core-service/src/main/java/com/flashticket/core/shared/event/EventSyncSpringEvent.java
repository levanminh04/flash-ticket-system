package com.flashticket.core.shared.event;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * mỗi khi thực hiện các hành động làm thay đổi trạng thái hiển thị của sự kiện, hệ thống sẽ "bắn" một EventSyncSpringEvent để cập nhật vào Search Engine
 *
 * TẠI SAO KHÔNG dùng Event entity trực tiếp?
 * → @TransactionalEventListener(AFTER_COMMIT) + @Async chạy trên thread khác
 * → Hibernate session đã đóng → Lazy proxy (venue, categories) gây LazyInitializationException
 *   luồng (thread) mới được tạo ra bởi @Async sẽ không được kế thừa Hibernate Session và Transaction của luồng gọi nó.
 *
 * GIẢI PHÁP: Extract tất cả data cần thiết TRONG transaction (eager), gửi Map thuần.
 *
 * @param data   pre-built map of event data (no lazy proxies)
 * @param action "PUBLISHED", "UPDATED", or "DELETED"
 */
public record EventSyncSpringEvent(
        Map<String, Object> data,
        String action)
{}
