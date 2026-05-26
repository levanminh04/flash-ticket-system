package com.flashticket.core.booking.repository;

import com.flashticket.core.booking.entity.OrderItemSeat;
import com.flashticket.core.booking.entity.OrderItemSeat.SeatReservationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface OrderItemSeatRepository extends JpaRepository<OrderItemSeat, UUID> {

    List<OrderItemSeat> findByOrderItemId(UUID orderItemId);

    List<OrderItemSeat> findByOrderItemIdIn(Collection<UUID> orderItemIds);

    @Query(value = """
        SELECT ois.*
        FROM booking_schema.order_item_seats ois
        JOIN booking_schema.order_items oi ON oi.id = ois.order_item_id
        WHERE oi.order_id = :orderId
        ORDER BY ois.created_at ASC
        """, nativeQuery = true)
    List<OrderItemSeat> findByOrderId(@Param("orderId") UUID orderId);

    @Modifying
    @Query("""
        UPDATE OrderItemSeat s
        SET s.status = :targetStatus
        WHERE s.orderItemId IN :orderItemIds
          AND s.status = :currentStatus
        """)
    int updateStatusForOrderItems(
        @Param("orderItemIds") Collection<UUID> orderItemIds,
        @Param("currentStatus") SeatReservationStatus currentStatus,
        @Param("targetStatus") SeatReservationStatus targetStatus
    );

    @Modifying
    @Query(value = """
        UPDATE booking_schema.order_item_seats ois
        SET status = :targetStatus
        FROM booking_schema.order_items oi
        WHERE oi.id = ois.order_item_id
          AND oi.order_id = :orderId
          AND ois.status = :currentStatus
        """, nativeQuery = true)
    int updateStatusForOrder(
        @Param("orderId") UUID orderId,
        @Param("currentStatus") String currentStatus,
        @Param("targetStatus") String targetStatus
    );
}
