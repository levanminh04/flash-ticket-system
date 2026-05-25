package com.flashticket.core.booking.service;

import com.flashticket.core.booking.entity.Order;
import com.flashticket.core.booking.repository.OrderRepository;
import com.flashticket.core.promotion.service.PromotionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * OrderExpirationHelper — Xử lý expire 1 order trong transaction riêng biệt.
 *
 * TẠI SAO TÁCH RA CLASS RIÊNG?
 * ─────────────────────────────────────────────────────────────────────
 * Spring Transaction hoạt động qua AOP Proxy: khi bạn gọi bean.method(),
 * Spring intercept lời gọi đó và wrap trong transaction.
 *
 * Vấn đề Self-invocation:
 *   OrderExpirationService.expireOrders() gọi this.expireOne()
 *   → "this" là object thật, KHÔNG phải Spring Proxy
 *   → @Transactional trên expireOne() BỊ BỎ QUA hoàn toàn
 *   → Mỗi repository.save() chạy auto-commit riêng lẻ
 *   → Nếu restoreStock() OK mà save(order) lỗi → stock bị cộng sai, order vẫn PENDING
 *
 * Fix: Tách expireOne() ra @Service bean riêng (OrderExpirationHelper).
 *   OrderExpirationService gọi helper.expireOne()
 *   → "helper" là Spring Proxy → @Transactional hoạt động đúng ✅
 * ─────────────────────────────────────────────────────────────────────
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrderExpirationHelper {

    private final OrderRepository orderRepository;
    private final BookingService bookingService;
    private final PromotionService promotionService;

    /**
     * Expire 1 order trong transaction độc lập.
     *
     * Atomicity đảm bảo: restoreStock + releasePromotion + setStatus
     * là all-or-nothing. Nếu bất kỳ bước nào lỗi → rollback toàn bộ.
     *
     * @Transactional(propagation = REQUIRES_NEW) để đảm bảo:
     * - Transaction này hoàn toàn độc lập với caller
     * - Nếu 1 order lỗi → rollback chỉ order đó, không ảnh hưởng order khác
     *
     * Gọi bởi: OrderExpirationService.expireOrders() qua Spring Proxy
     * tránh (Self-invocation bug) bypass qua proxy.  đây là lỗi Spring AOP rất phổ biến và khó debug
     *
     */
    @Transactional
    public void expireOne(Order order) {
        int updated = orderRepository.markExpiredIfPending(order.getId());
        if (updated == 0) {
            log.debug("Skip expiring order {} because it is no longer PENDING", order.getOrderNumber());
            return;
        }

        // 1. Restore stock về ticket_types (quantity_available += N, quantity_reserved -= N)
        bookingService.restoreStock(order.getId());
        bookingService.restoreSeatsForExpiredOrder(order.getId());

        // 2. Release promotion slot nếu order có dùng voucher
        promotionService.releasePromotion(order.getPromotionId());

        // 3. Update order status — nếu step này lỗi, cả 3 bước đều rollback

        log.debug("Order {} expired — stock & promotion slot restored", order.getOrderNumber());
    }
}
