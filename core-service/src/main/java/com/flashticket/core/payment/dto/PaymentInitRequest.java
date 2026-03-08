package com.flashticket.core.payment.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/**
 * Request body cho POST /api/payments/initiate
 * <p>
 * User gửi orderId + (optional) bankCode, provider.
 * Backend tạo Transaction trong DB → gọi VNPayGateway.createPaymentUrl() → trả URL.
 *
 * @param orderId   ID đơn hàng cần thanh toán — phải thuộc về user hiện tại, status = PENDING
 * @param bankCode  Optional: chỉ định ngân hàng (NCB, VCB, VNPAYQR...) — null = user tự chọn trên trang VNPay
 * @param provider  Payment provider — mặc định "VNPAY", sau này có thể "MOMO", "ZALOPAY"
 */
public record PaymentInitRequest(

    @NotNull(message = "orderId không được để trống")
    UUID orderId,

    String bankCode,

    String provider  // default "VNPAY" nếu null — xử lý trong service
) {
    /**
     * Trả provider chuẩn hóa — fallback "VNPAY" nếu null/blank
     */
    public String resolvedProvider() {
        return (provider == null || provider.isBlank()) ? "VNPAY" : provider.toUpperCase();
    }
}
