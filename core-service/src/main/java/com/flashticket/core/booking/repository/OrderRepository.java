package com.flashticket.core.booking.repository;

import com.flashticket.core.booking.entity.Order;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
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

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM Order o WHERE o.id = :id AND o.isDeleted = false")
    Optional<Order> findByIdForUpdate(@Param("id") UUID id);

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

    @Modifying
    @Query("""
           UPDATE Order o
           SET o.status = com.flashticket.core.booking.entity.Order.OrderStatus.CANCELLED,
               o.cancelledAt = :now,
               o.cancelledBy = :userId,
               o.cancellationReason = :reason
           WHERE o.id = :orderId
             AND o.userId = :userId
             AND o.status = com.flashticket.core.booking.entity.Order.OrderStatus.PENDING
             AND o.isDeleted = false
           """)
    int markCancelledIfPending(
        @Param("orderId") UUID orderId,
        @Param("userId") String userId,
        @Param("now") Instant now,
        @Param("reason") String reason
    );

    @Modifying
    @Query("""
           UPDATE Order o
           SET o.status = com.flashticket.core.booking.entity.Order.OrderStatus.EXPIRED
           WHERE o.id = :orderId
             AND o.status = com.flashticket.core.booking.entity.Order.OrderStatus.PENDING
             AND o.isDeleted = false
           """)
    int markExpiredIfPending(@Param("orderId") UUID orderId);

    @Modifying
    @Query("""
           UPDATE Order o
           SET o.status = com.flashticket.core.booking.entity.Order.OrderStatus.CONFIRMED,
               o.paidAt = :paidAt
           WHERE o.id = :orderId
             AND o.status = com.flashticket.core.booking.entity.Order.OrderStatus.PENDING
             AND o.isDeleted = false
           """)
    int markConfirmedIfPending(
        @Param("orderId") UUID orderId,
        @Param("paidAt") Instant paidAt
    );
}
