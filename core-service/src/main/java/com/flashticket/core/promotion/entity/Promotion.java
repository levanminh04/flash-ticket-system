package com.flashticket.core.promotion.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Promotion Entity — promotion_schema.promotions
 * Chương trình khuyến mãi / Voucher code.
 */
@Entity
@Table(
    name = "promotions",
    schema = "promotion_schema",
    indexes = {
        @Index(name = "idx_promotions_code",   columnList = "code"),
        @Index(name = "idx_promotions_status", columnList = "status")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Promotion {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    // Discount Configuration
    @Enumerated(EnumType.STRING)
    @Column(name = "discount_type", nullable = false, length = 20)
    private DiscountType discountType;

    /** 10.0 cho PERCENTAGE (10%), hoặc 50000 cho FIXED_AMOUNT (50.000 VND) */
    @Column(name = "discount_value", nullable = false, precision = 15, scale = 2)
    private BigDecimal discountValue;

    /** Giảm tối đa (dùng cho PERCENTAGE để cap giảm giá) */
    @Column(name = "max_discount_amount", precision = 15, scale = 2)
    private BigDecimal maxDiscountAmount;

    // Conditions
    @Column(name = "min_order_value", precision = 15, scale = 2)
    private BigDecimal minOrderValue = BigDecimal.ZERO;

    @Column(name = "min_quantity")
    private Integer minQuantity = 1;

    // Scope
    @Enumerated(EnumType.STRING)
    @Column(name = "applicable_scope", length = 50)
    private ApplicableScope applicableScope = ApplicableScope.ALL;

    // Usage Limits
    @Column(name = "max_total_uses")
    private Integer maxTotalUses;

    @Column(name = "max_uses_per_user")
    private Integer maxUsesPerUser = 1;

    @Column(name = "current_uses")
    private Integer currentUses = 0;

    // Validity Period
    @Column(name = "start_datetime", nullable = false)
    private Instant startDatetime;

    @Column(name = "end_datetime", nullable = false)
    private Instant endDatetime;

    // Status
    @Enumerated(EnumType.STRING)
    @Column(length = 50)
    private PromotionStatus status = PromotionStatus.ACTIVE;

    // Audit
    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @CreatedBy
    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;

    public enum DiscountType {
        PERCENTAGE, FIXED_AMOUNT
    }

    public enum ApplicableScope {
        ALL, SPECIFIC_EVENTS, SPECIFIC_CATEGORIES
    }

    public enum PromotionStatus {
        DRAFT, ACTIVE, PAUSED, EXPIRED
    }
}
