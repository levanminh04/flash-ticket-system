package com.flashticket.core.payment.gateway;

import com.flashticket.core.payment.config.VNPayProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * VNPay Payment Gateway Implementation
 * <p>
 * Tham khảo: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html
 *
 * <h3>VNPay Specifics:</h3>
 * <ul>
 *   <li>vnp_Amount = amount × 100 (15,000 VND → "1500000")</li>
 *   <li>vnp_CreateDate = format "yyyyMMddHHmmss" timezone GMT+7</li>
 *   <li>Hash algorithm: HMAC-SHA512 (không phải SHA256)</li>
 *   <li>Params phải sort theo key (alphabetically) trước khi hash</li>
 *   <li>URL encode VALUE khi build query string, không encode KEY</li>
 * </ul>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class VNPayGateway implements PaymentGateway {

    private static final String HMAC_SHA512 = "HmacSHA512"; // VNPay API phiên bản mới nhất (2.1.0) ép buộc phải dùng thuật toán HmacSHA512 mã hóa (trước kia dùng SHA256). Nếu dùng thuật toán khác, chữ ký sẽ sai và VNPay từ chối thẳng.
    private static final DateTimeFormatter VNP_DATE_FORMAT =
        DateTimeFormatter.ofPattern("yyyyMMddHHmmss"); // Server của VNPay chỉ hiểu đúng định dạng chuỗi này (ví dụ: 20260302111134). Nếu truyền chuẩn ISO (2026-03-02T11:11...), sẽ báo lỗi ngay.
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh"); // Nếu server thuê ở Mỹ (AWS, Google Cloud) thì giờ hệ thống mặc định sẽ là giờ Mỹ. Nếu bạn không ép nó về múi giờ Việt Nam (GMT+7), VNPay sẽ thấy thời gian tạo đơn hàng bị lệch mười mấy tiếng và báo lỗi "Giao dịch đã hết hạn" ngay lúc vừa tạo.
    private static final int EXPIRE_MINUTES = 20; // VNPay sẽ tự hết hạn giao dịch nếu quá thời gian này và khách không quét thanh toán

    private final VNPayProperties properties;

    // ────────────────────────────────────────────────────────────────────────────
    // createPaymentUrl
    // ────────────────────────────────────────────────────────────────────────────

    @Override
    public String createPaymentUrl(PaymentRequest request, String ipAddress) {
        LocalDateTime now = LocalDateTime.now(VN_ZONE);
        LocalDateTime expire = now.plusMinutes(EXPIRE_MINUTES);

        // vnp_Amount: VNPay yêu cầu nhân 100 (đơn vị là xu / 1/100 VND)
        long amountInSmallestUnit = request.amount()
            .multiply(BigDecimal.valueOf(100))
            .longValue();

        // Build params map — dùng TreeMap để tự sort theo key, VNPay bắt buộc phải sắp xếp theo bảng chữ cái để làm chuẩn cho hash data và signature
        Map<String, String> params = new TreeMap<>();
        params.put("vnp_Version",    properties.getVersion());
        params.put("vnp_Command",    properties.getCommand());
        params.put("vnp_TmnCode",    properties.getTmnCode());
        params.put("vnp_Amount",     String.valueOf(amountInSmallestUnit));
        params.put("vnp_CurrCode",   properties.getCurrencyCode());
        params.put("vnp_TxnRef",     request.transactionNumber());
        params.put("vnp_OrderInfo",  request.orderInfo());
        params.put("vnp_OrderType",  "other");            // Loại hàng hóa
        params.put("vnp_Locale",     properties.getLocale());
        params.put("vnp_ReturnUrl",  properties.getReturnUrl()); // Khi khách hàng thanh toán xong (dù thành công, thất bại hay bấm nút Hủy). VNPay sẽ dùng cái vnp_ReturnUrl này để điều hướng (redirect) trình duyệt của khách hàng quay trở lại website hoặc ứng dụng của mình.
        params.put("vnp_IpAddr",     ipAddress);
        params.put("vnp_CreateDate", now.format(VNP_DATE_FORMAT));
        params.put("vnp_ExpireDate", expire.format(VNP_DATE_FORMAT));

        // Optional: chỉ định ngân hàng (null = user chọn trên trang VNPay)
        if (request.bankCode() != null && !request.bankCode().isBlank()) {
            params.put("vnp_BankCode", request.bankCode());
        }

        // Tạo hash data và signature
        String hashData    = buildHashData(params); // "key=value&key=value..." dùng raw value, không encode trước khi băm
        String secureHash  = hmacSHA512(properties.getHashSecret(), hashData);

        // Build query string (URL encode values)
        String queryString = buildQueryString(params);

        String paymentUrl = properties.getPaymentUrl() + "?" + queryString
            + "&vnp_SecureHash=" + secureHash;

        log.info("[VNPay] Created payment URL for txnRef={}, amount={}",
            request.transactionNumber(), request.amount());
        log.debug("[VNPay] Payment URL: {}", paymentUrl);

        return paymentUrl;
    }

    // ────────────────────────────────────────────────────────────────────────────
    // verifyCallback
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Xác minh chữ ký HMAC-SHA512 từ VNPay — "Bảo vệ viên" chống giả mạo.
     * <p>
     * <b>Tại sao cần?</b><br>
     * Hacker có thể giả request đến server bạn với nội dung:
     * "Đơn hàng 500k đã thanh toán thành công" — nếu không verify thì hệ thống
     * sẽ issue vé miễn phí. verifyCallback đảm bảo request đó THỰC SỰ đến từ VNPay.

     Hiện tại đang expect frontend polling 3 giây 1 lần (tối đa 20 lần retry) check status PENDING (chờ IPN update SUCCESS or FAILED)
     trong khi polling thì hiển thị "đang xử lý"
     => sau này sẽ dùng websocket để bắn status thay vì polling

     *
     * @param params Tất cả query params từ VNPay (bao gồm vnp_SecureHash)
     * @return true nếu chữ ký hợp lệ — data chưa bị chỉnh sửa
     */
    @Override
    public boolean verifyCallback(Map<String, String> params) {
        // Lấy hash VNPay gửi về
        String receivedHash = params.get("vnp_SecureHash");
        if (receivedHash == null || receivedHash.isBlank()) {
            log.warn("[VNPay] Missing vnp_SecureHash in callback params");
            return false;
        }

        // Rebuild hash từ params (loại bỏ vnp_SecureHash và vnp_SecureHashType)
        // Phải loại bỏ vì khi VNPay tạo hash ban đầu, họ cũng không tính 2 field này
        Map<String, String> paramsToSign = new TreeMap<>(params);
        paramsToSign.remove("vnp_SecureHash");
        paramsToSign.remove("vnp_SecureHashType");

        String hashData       = buildHashData(paramsToSign);
        String expectedHash   = hmacSHA512(properties.getHashSecret(), hashData);

        boolean valid = expectedHash.equalsIgnoreCase(receivedHash);
        if (!valid) {
            log.warn("[VNPay] Signature mismatch! txnRef={}",
                params.get("vnp_TxnRef"));
        }
        return valid;
    }

    // ────────────────────────────────────────────────────────────────────────────
    // parseCallbackResult
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * "Phiên dịch viên" — dịch ngôn ngữ VNPay sang ngôn ngữ hệ thống.
     * <p>
     * VNPay trả về hơn 20 params với tên viết tắt khó hiểu (vnp_TxnRef, vnp_TransactionNo,
     * vnp_ResponseCode...). Hàm này extract chỉ những field cần thiết và đóng gói vào
     * {@link PaymentResult} — một cấu trúc chung mà PaymentService hiểu được.
     * <p>
     * <b>Chỉ gọi SAU khi verifyCallback() trả true.</b> Nếu gọi trước → có thể parse
     * data giả mạo → logic sai.

     * Mapping VNPay → PaymentResult:
     *      vnp_TxnRef         → transactionNumber  (mã giao dịch hệ thống, do ta tạo lúc initiatePayment)
     *      vnp_TransactionNo  → providerTransactionId  (mã giao dịch VNPay tạo, ví dụ: "14422639")
     *      vnp_ResponseCode   → responseCode  ("00"=thành công, "24"=hủy, "51"=hết tiền...)
     *      vnp_Amount ÷ 100   → amount  (VNPay gửi 15000000 → ta lưu 150000 VNĐ)
     *      vnp_BankCode       → bankCode  (NCB, VCB, VNPAYQR...)
     *      vnp_CardType       → cardType  (ATM, CREDIT...)
     *      toàn bộ params     → rawParams  (lưu JSONB vào DB để audit sau này)

     * Lưu ý vnp_Amount: VNPay nhân 100 để loại phần thập phân (150,000 VNĐ → "15000000").
     * Ta phải chia lại 100 trước khi lưu DB và so sánh với order.totalAmount.
     *
     * @param params Tất cả params VNPay gửi về (đã verify signature)
     * @return PaymentResult chứa thông tin thanh toán đã chuẩn hóa
     */
    @Override
    public PaymentResult parseCallbackResult(Map<String, String> params) {
        // vnp_Amount từ VNPay là amount × 100 → chia lại để lưu VNĐ gốc
        BigDecimal amount = new BigDecimal(params.getOrDefault("vnp_Amount", "0"))
            .divide(BigDecimal.valueOf(100));

        return new PaymentResult(
            params.get("vnp_TxnRef"),           // transaction number của hệ thống
            params.get("vnp_TransactionNo"),     // VNPay transaction ID
            params.get("vnp_ResponseCode"),      // "00" = success
            amount,
            params.get("vnp_BankCode"),
            params.get("vnp_CardType"),
            new HashMap<>(params)               // snapshot toàn bộ params để audit
        );
    }

    // ────────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Build hash data string: "key=value&key=value..." theo thứ tự key sorted.
     * Không URL encode trong hash data — chỉ concatenate raw value.
     */
    private String buildHashData(Map<String, String> params) {
        return params.entrySet().stream()
            .filter(e -> e.getValue() != null && !e.getValue().isBlank())
            .map(e -> e.getKey() + "=" + encodeValue(e.getValue()))
            .collect(Collectors.joining("&"));
    }

    /**
     * Build query string cho URL: "key=encodedValue&key=encodedValue...".
     * Values phải URL encode (UTF-8).
     */
    private String buildQueryString(Map<String, String> params) {
        return params.entrySet().stream()
            .filter(e -> e.getValue() != null && !e.getValue().isBlank())
            .map(e -> e.getKey() + "=" + encodeValue(e.getValue()))
            .collect(Collectors.joining("&"));
    }
    private String encodeValue(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    /**
     * HMAC-SHA512 hash.
     *
     * @param secret   HashSecret từ VNPay
     * @param data     String cần hash
     * @return Hex string lowercase
     */
    private String hmacSHA512(String secret, String data) {
        try {
            Mac mac = Mac.getInstance(HMAC_SHA512);
            SecretKeySpec keySpec = new SecretKeySpec(
                secret.getBytes(StandardCharsets.UTF_8), HMAC_SHA512);
            mac.init(keySpec);
            byte[] hashBytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            // data.getBytes(StandardCharsets.UTF_8); dừng ở đây thì đúng là chuyển ký tự → số ASCII (UTF-8).
            // nhưng mac.doFinal thực hiện thuật toán HMAC_SHA512 để trả về 1 mảng byte khác

            // Convert to hex string
            StringBuilder sb = new StringBuilder();
            for (byte b : hashBytes) {
                sb.append(String.format("%02x", b));
            }
            // x: chuyển sang hexadecimal (base 16)
            //  lấy từng byte chuyển thành hệ cơ số 16, %02x:
            //  0: Nếu kết quả chỉ có 1 ký tự, tự động nhét thêm số 0 vào đằng trước.
            //  2: Đảm bảo độ dài luôn là 2 ký tự.
            //  x: Biến tất cả các chữ cái (A-F) thành chữ cái viết thường (a-f). VNPay yêu cầu chữ ký phải là chữ viết thường
            // VNPAY yêu cầu chữ ký bảo mật được biểu diễn dưới dạng chuỗi hệ cơ số 16

            return sb.toString();
        } catch (Exception e) {
            log.error("[VNPay] HMAC-SHA512 failed: {}", e.getMessage(), e);
            throw new RuntimeException("VNPay HMAC signing failed", e);
        }
    }
}
