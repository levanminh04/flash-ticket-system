package com.flashticket.core.payment.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Response body cho POST /api/payments/initiate
 * <p>
 * Frontend nhận paymentUrl → redirect user sang cổng thanh toán VNPay.
 *
 * @param transactionId     ID transaction trong DB (để client tracking)
 * @param transactionNumber Mã giao dịch (vnp_TxnRef) — hiển thị cho user
 * @param paymentUrl        URL redirect đến cổng thanh toán VNPay (đã ký HMAC)
 * @param amount            Số tiền thanh toán (VND)
 * @param provider          Payment gateway sử dụng ("VNPAY")
 * @param expiresAt         URL hết hạn — sau thời gian này user không thể thanh toán nữa
 */
public record PaymentInitResponse(
    UUID transactionId,
    String transactionNumber,
    String paymentUrl,
    BigDecimal amount,
    String provider,
    Instant expiresAt
) {}
