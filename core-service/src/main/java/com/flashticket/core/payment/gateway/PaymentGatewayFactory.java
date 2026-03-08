package com.flashticket.core.payment.gateway;

import com.flashticket.core.common.exception.InvalidRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Factory — resolve đúng PaymentGateway implementation theo provider name.
 * Nếu không có PaymentGatewayFactory, class PaymentService sẽ phải tự mình kiểm tra xem khách hàng muốn dùng cổng thanh toán nào:
 * <p>
 * Hiện tại hỗ trợ: VNPAY
 * Tương lai: MOMO, ZALOPAY, BANK_TRANSFER
 */
@Component
@RequiredArgsConstructor
public class PaymentGatewayFactory {

    private final VNPayGateway vnPayGateway;

    /**
     * @param provider Provider name (case-insensitive): "VNPAY", "MOMO", etc.
     * @return Đúng gateway implementation
     * @throws InvalidRequestException nếu provider chưa được hỗ trợ
     */
    public PaymentGateway getGateway(String provider) {
        return switch (provider.toUpperCase()) {
            case "VNPAY" -> vnPayGateway;
            default -> throw new InvalidRequestException(
                "Payment gateway không hỗ trợ: " + provider +
                ". Các gateway hỗ trợ: VNPAY");
        };
    }
}
