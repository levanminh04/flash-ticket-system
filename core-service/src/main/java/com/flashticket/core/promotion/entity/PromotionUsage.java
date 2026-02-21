package com.flashticket.core.promotion.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * PromotionUsage Entity — promotion_schema.promotion_usages
 * Tracking lịch sử sử dụng voucher — dùng để enforce max_uses_per_user.
 */
@Entity
@Table(
    name = "promotion_usages",
    schema = "promotion_schema",
    indexes = {
        @Index(name = "idx_promo_usage_user",      columnList = "user_id"),
        @Index(name = "idx_promo_usage_promotion", columnList = "promotion_id"),
        @Index(name = "idx_promo_usage_order",     columnList = "order_id")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PromotionUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "promotion_id", nullable = false)
    private UUID promotionId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "discount_amount", nullable = false, precision = 15, scale = 2)
    private BigDecimal discountAmount;

    @CreatedDate
    @Column(name = "used_at", nullable = false, updatable = false)
    private Instant usedAt;
}
