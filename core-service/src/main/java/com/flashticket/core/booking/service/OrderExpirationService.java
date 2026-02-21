package com.flashticket.core.booking.service;

import com.flashticket.core.booking.entity.Order;
import com.flashticket.core.booking.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * OrderExpirationService — Scheduler tự động expire orders PENDING đã quá hạn.
 *
 * Chạy mỗi 60 giây, lấy tối đa 50 orders/lần để tránh overload.
 * Mỗi order được xử lý trong transaction độc lập qua OrderExpirationHelper.
 *
 * Trade-off: Delay tối đa 60s là acceptable cho hệ thống booking thông thường.
 * Flash sale khắc nghiệt → giảm interval xuống 10s hoặc dùng Redis keyspace notification.
 *
 * ─── TRANSACTION DESIGN ─────────────────────────────────────────────────────
 * Class này KHÔNG có @Transactional để tránh 2 anti-pattern:
 *
 * Anti-pattern 1 — Self-invocation (bug cũ):
 *   this.expireOne(order) → bypass Spring Proxy → @Transactional bị bỏ qua
 *   → restoreStock OK nhưng save(order) lỗi → dữ liệu không nhất quán
 *
 * Anti-pattern 2 — @Transactional trên expireOrders():
 *   → 50 orders gộp vào 1 transaction duy nhất
 *   → Order 50 lỗi → rollback 49 order trước
 *
 * Fix: Delegate sang OrderExpirationHelper.expireOne() — bean riêng,
 *   Spring Proxy hoạt động đúng, mỗi order là 1 transaction độc lập. ✅
 * ────────────────────────────────────────────────────────────────────────────
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderExpirationService {

    private final OrderRepository orderRepository;
    private final OrderExpirationHelper expirationHelper; // ← bean riêng, đi qua Proxy

    /**
     * Mỗi đơn hàng trong expireOne là một Transaction riêng. Điều này có nghĩa là:
     * Khi vòng lặp chạy, nó sẽ liên tục mượn 1 kết nối (Connection) từ Pool, thực hiện xong rồi trả lại.
     * Nếu để Batch Size quá lớn (10,000) và hệ thống đang có nhiều người dùng cùng lúc:
     * Vòng lặp này sẽ chiếm dụng/giải phóng kết nối liên tục với tần suất cực cao.
     * Mục tiêu là quét đơn hàng mỗi 60 giây. Nếu một lần chạy mất 8 phút xử ly 1000 orders , thì các chu kỳ tiếp theo sẽ bị đẩy lùi lại rất xa so với thực tế, làm sai lệch logic "Flash Sale" hoặc "giữ chỗ".
     * */
    private static final int BATCH_SIZE = 50;

    @Scheduled(fixedDelay = 60_000)
    public void expireOrders() {
        List<Order> expiredOrders = orderRepository.findExpiredPendingOrders(
            Instant.now(),
            PageRequest.of(0, BATCH_SIZE)
        );

        if (expiredOrders.isEmpty()) {
            return;
        }

        log.info("Found {} expired orders to process", expiredOrders.size());

        int successCount = 0;
        int failCount = 0;

        for (Order order : expiredOrders) {
            try {
                // Gọi qua Spring Proxy → @Transactional hoạt động đúng
                // Mỗi order là 1 transaction độc lập: lỗi 1 không ảnh hưởng order khác
                expirationHelper.expireOne(order);
                successCount++;
            } catch (Exception e) {
                failCount++;
                log.error("Failed to expire order {}: {}", order.getOrderNumber(), e.getMessage(), e);
            }
        }

        log.info("Expiration batch done. Success: {}, Failed: {}", successCount, failCount);
    }
}
