package com.flashticket.core.shared.event;

import java.util.UUID;

/**
 * Event được publish vào RabbitMQ sau khi VNPay IPN xác nhận thanh toán thành công.
 *
 * <p>Chỉ truyền {@code orderId} — Consumer tự load đầy đủ dữ liệu từ DB.
 * Tránh anti-pattern "Fat Message" (nhồi quá nhiều data vào message → khó version, khó evolve).
 *
 * @param orderId ID của Order vừa được xác nhận thanh toán
 */
public record PaymentSuccessEvent(UUID orderId) {}
