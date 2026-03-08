package com.flashticket.core.payment.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Response body cho GET /api/payments/status/{orderId}
 * <p>
 * Trả lại trạng thái thanh toán tổng quan + danh sách transactions.
 * Frontend dùng endpoint này để polling result sau khi user quay về từ VNPay.
 *
 * @param orderId         ID đơn hàng
 * @param orderStatus     Trạng thái order hiện tại (PENDING, CONFIRMED, CANCELLED...)
 * @param totalAmount     Tổng tiền đơn hàng
 * @param transactions    Danh sách giao dịch — mới nhất trước. User có thể thử thanh toán nhiều lần.
 */
public record PaymentStatusResponse(
    java.util.UUID orderId,
    String orderStatus,
    BigDecimal totalAmount,
    List<TransactionSummary> transactions
) {
    /**
     * Tóm tắt 1 transaction — embedded trong PaymentStatusResponse.
     *
     * @param transactionNumber  Mã giao dịch hệ thống (vnp_TxnRef)
     * @param status             PENDING / SUCCESS / FAILED / CANCELLED
     * @param amount             Số tiền giao dịch
     * @param paymentMethod      "VNPAY", "MOMO"...
     * @param responseCode       VNPay response code ("00" = success) — null nếu chưa có kết quả
     * @param bankCode           Ngân hàng thực hiện — null nếu chưa thanh toán
     * @param initiatedAt        Thời điểm tạo giao dịch
     * @param completedAt        Thời điểm hoàn thành — null nếu chưa xong
     */
    public record TransactionSummary(
        String transactionNumber,
        String status,
        BigDecimal amount,
        String paymentMethod,
        String responseCode,
        String bankCode,
        Instant initiatedAt,
        Instant completedAt
    ) {}
}
