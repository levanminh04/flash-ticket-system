package com.flashticket.discovery.agent.tool;

import com.flashticket.discovery.chat.service.JwtContextHolder;
import com.flashticket.discovery.shared.client.CoreServiceClient;
import com.flashticket.discovery.shared.client.CoreServiceClient.PaymentInitPayload;
import dev.langchain4j.agent.tool.P;
import dev.langchain4j.agent.tool.Tool;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Tool tạo VNPay payment link — gọi POST /api/payments/initiate trên core-service.
 *
 * RÀNG BUỘC:
 * - Chỉ gọi SAU KHI user confirm muốn thanh toán
 * - Chỉ hoạt động với Order status = PENDING
 * - JWT lấy từ ThreadLocal (JwtContextHolder)
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PaymentTool {

    private final CoreServiceClient coreClient;

    @Tool("""
        Tạo link thanh toán VNPay cho đơn hàng. CHỈ gọi khi user XÁC NHẬN muốn thanh toán.
        Trả về URL thanh toán để user click vào.
        Đơn hàng phải đang ở trạng thái PENDING.
        """)
    public String createPaymentLink(
            @P("UUID của đơn hàng cần thanh toán") String orderId,
            @P("Mã ngân hàng (optional, null để user tự chọn trên VNPay)") String bankCode) {

        String jwt = JwtContextHolder.get();
        if (jwt == null) {
            return "ERROR: Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.";
        }

        log.info("[PaymentTool] Creating payment for order: {}", orderId);

        var payload = new PaymentInitPayload(
                UUID.fromString(orderId), bankCode, "VNPAY");

        return coreClient.initiatePayment(jwt, payload);
    }
}
