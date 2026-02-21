package com.flashticket.core.booking.repository;

import com.flashticket.core.booking.entity.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<Order, UUID> {

    /**
     * Lấy danh sách orders của user, sắp xếp mới nhất lên đầu.
     * Dùng cho API GET /api/orders/my-orders
     */
    Page<Order> findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(String userId, Pageable pageable);

    /**
     * Tìm order theo ID và đảm bảo thuộc về user — tránh IDOR attack.
     * Dùng cho API GET /api/orders/{id}
     */
    Optional<Order> findByIdAndUserIdAndIsDeletedFalse(UUID id, String userId);

    /**
     * Tìm tất cả PENDING orders đã quá hạn.
     * Dùng bởi OrderExpirationService (@Scheduled).
     * Chỉ xử lý tối đa 100 orders mỗi lần để tránh long-running transaction.
     */
    @Query("""
            SELECT o FROM Order o
            WHERE o.status = com.flashticket.core.booking.entity.Order.OrderStatus.PENDING
              AND o.expiresAt < :now
              AND o.isDeleted = false
            ORDER BY o.expiresAt ASC
            """)
    List<Order> findExpiredPendingOrders(@Param("now") Instant now, Pageable pageable);

    /**
     * Kiểm tra user có đang có order PENDING cho event này không.
     * Dùng để ngăn duplicate booking.
     */
    boolean existsByUserIdAndEventIdAndStatusAndIsDeletedFalse(
        String userId, UUID eventId, Order.OrderStatus status);
}
