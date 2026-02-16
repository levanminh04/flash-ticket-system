package com.flashticket.core.booking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Order Entity - booking_schema.orders
 * Đơn hàng chính
 */
@Entity
@Table(name = "orders", schema = "booking_schema", indexes = {
        @Index(name = "idx_orders_user", columnList = "user_id"),
        @Index(name = "idx_orders_event", columnList = "event_id"),
        @Index(name = "idx_orders_status", columnList = "status"),
        @Index(name = "idx_orders_number", columnList = "order_number"),
        @Index(name = "idx_orders_created", columnList = "created_at"),
        @Index(name = "idx_orders_expires", columnList = "expires_at")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "order_number", nullable = false, unique = true, length = 50)
    private String orderNumber;

    // Customer (LOGICAL REFERENCE)
    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "customer_email", nullable = false)
    private String customerEmail;

    @Column(name = "customer_phone", length = 20)
    private String customerPhone;

    @Column(name = "customer_name")
    private String customerName;

    // Event (LOGICAL REFERENCE - cross schema)
    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Column(name = "event_title")
    private String eventTitle;

    @Column(name = "event_start_datetime")
    private Instant eventStartDatetime;

    @Column(name = "event_venue_name")
    private String eventVenueName;

    // Pricing
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "discount_amount", precision = 15, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    @Column(name = "total_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal totalAmount;

    private String currency = "VND";

    // Promotion (LOGICAL REFERENCE)
    @Column(name = "promotion_id")
    private UUID promotionId;

    @Column(name = "promotion_code", length = 50)
    private String promotionCode;

    // Status & Lifecycle
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private OrderStatus status = OrderStatus.PENDING;

    // Payment Tracking
    @Column(name = "payment_method", length = 50)
    private String paymentMethod;

    @Column(name = "paid_at")
    private Instant paidAt;

    // Expiration
    @Column(name = "expires_at")
    private Instant expiresAt;

    // Notes
    @Column(name = "customer_note", columnDefinition = "TEXT")
    private String customerNote;

    @Column(name = "internal_note", columnDefinition = "TEXT")
    private String internalNote;

    // Source Tracking
    private String source = "WEB";

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "user_agent", columnDefinition = "TEXT")
    private String userAgent;

    // Audit fields
    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @CreatedBy
    @Column(name = "created_by")
    private String createdBy;

    @LastModifiedBy
    @Column(name = "updated_by")
    private String updatedBy;

    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Column(name = "cancelled_by")
    private String cancelledBy;

    @Column(name = "cancellation_reason", columnDefinition = "TEXT")
    private String cancellationReason;

    public enum OrderStatus {
        PENDING, CONFIRMED, CANCELLED, REFUNDED, EXPIRED
    }
}
