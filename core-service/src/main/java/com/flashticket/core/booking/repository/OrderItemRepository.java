package com.flashticket.core.booking.repository;

import com.flashticket.core.booking.entity.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {

    /**
     * Lấy tất cả order items của 1 order.
     * Dùng khi cần tính toán tổng, hoặc khi cấp vé (ticket issuance).
     */
    List<OrderItem> findByOrderId(UUID orderId);

    /**
     * Lấy order items cho nhiều orders cùng lúc (bulk).
     * Dùng khi render danh sách orders với detail.
     */
    List<OrderItem> findByOrderIdIn(List<UUID> orderIds);
}
