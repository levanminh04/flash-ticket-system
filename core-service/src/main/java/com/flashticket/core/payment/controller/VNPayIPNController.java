package com.flashticket.core.payment.controller;

import com.flashticket.core.payment.gateway.VNPayResponseCode;
import com.flashticket.core.payment.service.VNPayIPNService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;

/**
 * VNPay IPN (Instant Payment Notification) Controller.
 * <p>
 * TÁCH RIÊNG khỏi PaymentController vì:
 * <ul>
 *   <li>IPN endpoint KHÔNG yêu cầu JWT — VNPay gọi server-to-server</li>
 *   <li>Phải public access (cần whitelist trong SecurityConfig)</li>
 *   <li>VNPay gửi GET request (không phải POST)</li>
 *   <li>Response format cố định: {"RspCode":"XX","Message":"..."}</li>
 * </ul>
 * <p>
 * Flow khi user thanh toán xong:
 * <pre>
 * 1. User thanh toán trên trang VNPay → thành công
 * 2. VNPay gọi GET server/api/payments/vnpay-ipn?vnp_TxnRef=...&vnp_ResponseCode=00&...
 * 3. Controller extract tất cả params → gọi VNPayIPNService.processIPN()
 * 4. Return {"RspCode":"00","Message":"Confirm Success"}
 * 5. Nếu timeout > 3s hoặc response != "00" → VNPay retry
 * </pre>
 * <p>
 * Tham khảo pg_epm: VNPayServiceImpl.vnPayIPN() + Redis SetNx idempotency.
 */
@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
@Slf4j
public class VNPayIPNController {

    private final VNPayIPNService ipnService;

    /**
     * GET /api/payments/vnpay-ipn — VNPay IPN callback.
     * <p>
     * VNPay gửi tất cả params dưới dạng query string:
             GET /api/v1/payments/vnpay-ipn?vnp_Amount=15000000&vnp_BankCode=NCB&vnp_BankTranNo=VNP12345678&vnp_CardType=ATM
             &vnp_OrderInfo=Thanh+toan+ve+xem+phim&vnp_PayDate=20260309000512&vnp_ResponseCode=00&vnp_TmnCode=DEMO001
             &vnp_TransactionNo=14422639&vnp_TxnRef=ORDER_999_17150123&vnp_SecureHash=a1b2c3d4e5f6...
     *
     * @return Map{"RspCode":"XX","Message":"..."} — VNPay chỉ chấp nhận format này
     */
    @GetMapping("/vnpay-ipn")
    public Map<String, String> handleVNPayIPN(HttpServletRequest request) {
        try {
            // Extract tất cả query params từ VNPay
            Map<String, String> params = extractParams(request);

            log.info("[VNPay IPN] Received callback — txnRef={}, responseCode={}, amount={}",
                params.get("vnp_TxnRef"),
                params.get("vnp_ResponseCode"),
                params.get("vnp_Amount"));

            // Delegate xử lý cho IPNService
            return ipnService.processIPN(params);

        } catch (Exception e) {
            log.error("[VNPay IPN] Unexpected error: {}", e.getMessage(), e);
            return VNPayResponseCode.UNKNOWN_ERROR.toResponse();
        }
    }

    /**
     * Extract tất cả query params từ HttpServletRequest thành Map.
     * <p>
     * VNPay gửi params qua query string (GET request).
     * HttpServletRequest.getParameterNames() trả tất cả params.
     */
    private Map<String, String> extractParams(HttpServletRequest request) {
        Map<String, String> params = new HashMap<>();
        Enumeration<String> paramNames = request.getParameterNames();
        while (paramNames.hasMoreElements()) {
            String name = paramNames.nextElement();
            params.put(name, request.getParameter(name));
        }
        return params;
    }
}
