package com.flashticket.core.booking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * OrderItem Entity — booking_schema.order_items
 *
 * Đại diện cho 1 dòng trong đơn hàng: "2 vé loại Regular" hoặc "1 vé VIP".
 * Không phải vé thực — vé thực nằm ở booking_schema.tickets.
 *
 * Mối quan hệ:
 *   Order 1 → N OrderItems
 *   OrderItem 1 → N Tickets (1 item qty=3 → 3 ticket records)
 */
@Entity
@Table(
    name = "order_items",
    schema = "booking_schema",
    indexes = {
        @Index(name = "idx_order_items_order", columnList = "order_id")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Parent Order
    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    // Ticket Type (LOGICAL REFERENCE — cross schema)
    @Column(name = "ticket_type_id", nullable = false)
    private UUID ticketTypeId;

    /**
     * Cache tên loại vé tại thời điểm mua.
     * Không reference sang TicketType entity để tránh cross-schema JPA join.
     * Dữ liệu được denormalize vì tên vé có thể thay đổi sau này.
     */
    @Column(name = "ticket_type_name", length = 100)
    private String ticketTypeName;

    // Sector info (LOGICAL REFERENCE — cache event_sector tại thời điểm booking)
    @Column(name = "sector_id")
    private UUID sectorId;

    @Column(name = "sector_name", length = 100)
    private String sectorName;

    // Quantity & Pricing — snapshot tại thời điểm booking
    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", nullable = false, precision = 15, scale = 2)
    private BigDecimal unitPrice;

    /**
     * subtotal = unitPrice * quantity
     * Được tính sẵn để tránh tính toán lại khi hiển thị.
     */
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal subtotal;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
