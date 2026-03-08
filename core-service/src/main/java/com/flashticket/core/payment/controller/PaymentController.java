package com.flashticket.core.payment.controller;

import com.flashticket.core.payment.dto.PaymentInitRequest;
import com.flashticket.core.payment.dto.PaymentInitResponse;
import com.flashticket.core.payment.dto.PaymentStatusResponse;
import com.flashticket.core.payment.service.PaymentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * IPN endpoint (VNPay callback) sẽ nằm ở class riêng — Step 3.
 * Tách riêng vì IPN không require JWT (VNPay gọi server-to-server).
 */
@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
@Slf4j
public class PaymentController {

    private final PaymentService paymentService;

    /**
     * POST /api/payments/initiate — Tạo payment URL. Đây là "phát súng" đầu tiên mở màn cho toàn bộ quy trình thanh toán.

     * Flow:
        user nhấn nút "Thanh toán ngay".
     * Frontend nhận response → redirect user:
            window.location.href = response.paymentUrl; => điều hướng đến trang của VNPAY để thanh toán
     */
    @PostMapping("/initiate")
    public ResponseEntity<PaymentInitResponse> initiatePayment(
        @Valid @RequestBody PaymentInitRequest request,
        @AuthenticationPrincipal Jwt jwt, //  Khi một request gửi kèm JWT token đến server, sau khi authen author thì save JwtAuthenticationToken vào SecurityContextHolder, keycloak mặc định Principal là object Jwt và  subject là (User ID).
        HttpServletRequest httpRequest
    ) {
        String userId = jwt.getSubject();
        String ipAddress = extractClientIp(httpRequest);

        log.info("[PaymentController] Initiate payment — userId={}, orderId={}, provider={}",
            userId, request.orderId(), request.resolvedProvider());

        PaymentInitResponse response = paymentService.initiatePayment(request, userId, ipAddress);

        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/payments/status/{orderId} — Polling trạng thái thanh toán.
     * <p>
     * Frontend gọi endpoint này sau khi user quay về từ VNPay.
     * Polling mỗi 2-3 giây cho đến khi orderStatus != "PENDING".
     * <p>
     * Response bao gồm:
     * <ul>
     *   <li>orderStatus: PENDING / CONFIRMED / CANCELLED / EXPIRED</li>
     *   <li>transactions: danh sách giao dịch, mới nhất trước</li>
     * </ul>
     *
     * @param orderId ID đơn hàng
     * @param jwt     Keycloak JWT — IDOR protection
     * @return PaymentStatusResponse
     */
    @GetMapping("/status/{orderId}")
    public ResponseEntity<PaymentStatusResponse> getPaymentStatus(
        @PathVariable UUID orderId,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String userId = jwt.getSubject();

        PaymentStatusResponse response = paymentService.getPaymentStatus(orderId, userId);

        return ResponseEntity.ok(response);
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Extract client IP — ưu tiên X-Forwarded-For (khi đi qua reverse proxy / Spring Cloud Gateway).
     * <p>
     * VNPay yêu cầu gửi IP thật của client để fraud detection.
     * Nếu không có proxy header → dùng remoteAddr.
     * HttpServletRequest có lưu thông tin địa chỉ IP của client.
     */
    private String extractClientIp(HttpServletRequest request) {

        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            // X-Forwarded-For có thể chứa nhiều IP: "client, proxy1, proxy2"
            // Lấy IP đầu tiên (client thật)
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr(); // getRemoteAddr() sẽ trả về IP của Proxy (Nginx, Apache, Cloudflare hoặc Load Balancer.)
        // Thông thường, Reverse Proxy (Nginx, Apache) hoặc Load Balancer là bên chịu trách nhiệm thêm hoặc cập nhật header X-Forwarded-For.
        // Khi qua Proxy đầu tiên: Proxy sẽ lấy IP kết nối trực tiếp với nó (IP thật của client) và điền vào X-Forwarded-For.
        // Khi qua chuỗi nhiều Proxy: Mỗi ông Proxy đi ngang qua sẽ "phẩy" một cái và thêm IP của ông Proxy trước đó vào danh sách.
    }
}
