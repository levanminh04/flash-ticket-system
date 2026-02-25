package com.flashticket.core.payment.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * Transaction Entity - payment_schema.transactions
 * Giao dịch thanh toán
 */
@Entity
@Table(name = "transactions", schema = "payment_schema", indexes = {
        @Index(name = "idx_transactions_order", columnList = "order_id"),
        @Index(name = "idx_transactions_user", columnList = "user_id"),
        @Index(name = "idx_transactions_status", columnList = "status"),
        @Index(name = "idx_transactions_provider", columnList = "provider_transaction_id")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Transaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "transaction_number", nullable = false, unique = true, length = 100)
    private String transactionNumber;

    // Order Link (LOGICAL REFERENCE - cross schema)
    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "order_number", length = 50)
    private String orderNumber;

    // User
    @Column(name = "user_id", nullable = false)
    private String userId;

    // Payment Details
    @Column(name = "payment_method", nullable = false, length = 50)
    private String paymentMethod;  // VNPAY, MOMO, BANK_TRANSFER

    @Column(name = "payment_provider", length = 50)
    private String paymentProvider;

    // Amount
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal amount;

    private String currency = "VND";

    // Provider Response
    @Column(name = "provider_transaction_id")
    private String providerTransactionId;

    @Column(name = "provider_response_code", length = 50)
    private String providerResponseCode;

    @Column(name = "provider_response_message", columnDefinition = "TEXT")
    private String providerResponseMessage;

    @Type(JsonType.class)
    @Column(name = "provider_raw_response", columnDefinition = "jsonb")
    private Map<String, Object> providerRawResponse;

    // Bank Info
    @Column(name = "bank_code", length = 20)
    private String bankCode;

    @Column(name = "card_type", length = 20)
    private String cardType;

    // Status
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private TransactionStatus status = TransactionStatus.PENDING;

    // Timestamps
    @Column(name = "initiated_at", nullable = false)
    private Instant initiatedAt = Instant.now();

    @Column(name = "completed_at")
    private Instant completedAt;

    // Refund tracking
    @Column(name = "is_refunded")
    private Boolean isRefunded = false;

    @Column(name = "refund_amount", precision = 15, scale = 2)
    private BigDecimal refundAmount;

    @Column(name = "refunded_at")
    private Instant refundedAt;

    @Column(name = "refund_reason", columnDefinition = "TEXT")
    private String refundReason;

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

    public enum TransactionStatus {
        PENDING, SUCCESS, FAILED, CANCELLED, REFUNDED
    }
}
