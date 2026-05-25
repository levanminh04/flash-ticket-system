package com.flashticket.core.payment.repository;

import com.flashticket.core.payment.entity.Transaction;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TransactionRepository extends JpaRepository<Transaction, UUID> {

    /**
     * Lấy transactions của 1 order — dùng khi check payment status.
     * Có thể có nhiều transactions nếu user thử thanh toán nhiều lần.
     */
    List<Transaction> findByOrderIdOrderByInitiatedAtDesc(UUID orderId);

    /**
     * Kiểm tra transaction đã được xử lý chưa — IDEMPOTENCY CHECK.
     *
     * VNPay có thể gửi IPN nhiều lần (retry). Trước khi xử lý IPN,
     * luôn kiểm tra providerTransactionId đã tồn tại chưa.
     * Nếu đã tồn tại → return "00" ngay mà không xử lý lại.
     */
    boolean existsByProviderTransactionId(String providerTransactionId);

    /**
     * Tìm transaction theo VNPay transaction reference.
     */
    Optional<Transaction> findByProviderTransactionId(String providerTransactionId);

    /**
     * Tìm transaction theo mã giao dịch hệ thống (vnp_TxnRef).
     * Dùng khi IPN/ReturnUrl callback — VNPay trả vnp_TxnRef = transactionNumber.
     */
    Optional<Transaction> findByTransactionNumber(String transactionNumber);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM Transaction t WHERE t.transactionNumber = :transactionNumber")
    Optional<Transaction> findByTransactionNumberForUpdate(@Param("transactionNumber") String transactionNumber);

    /**
     * Transaction SUCCESS mới nhất của order — dùng để confirm payment.
     */
    Optional<Transaction> findTopByOrderIdAndStatusOrderByInitiatedAtDesc(
        UUID orderId, Transaction.TransactionStatus status);
}
