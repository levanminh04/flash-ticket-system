package com.flashticket.core.payment.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * VNPay Configuration Properties
 * <p>
 * Bind từ config server (configserver/config/core-service.yml):
 * Thay vì bạn phải dùng @Value("${vnpay.tmn-code}") rải rác khắp nơi trong code (dễ sai chính tả và khó quản lý),
 * Spring Boot tự động gom tất cả các giá trị bắt đầu bằng vnpay.* trong file core-service.yml
 * và nhét vào các biến của class này. Khi cần dùng tmnCode hay hashSecret, chỉ cần gọi vnPayProperties.getTmnCode()
 *
 * <pre>
 * vnpay:
 *   tmn-code: UVPHUAJF
 *   hash-secret: ETWXSW8TEI0A4YLR58QBJJKC4WMOD3UW
 *   payment-url: https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
 *   return-url: http://localhost:5173/payment/result
 *   api-url: https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
 * </pre>
 */
@Component
@ConfigurationProperties(prefix = "vnpay")
@Getter
@Setter
public class VNPayProperties {

    // Nhóm Định danh & Bảo mật (Quan trọng)

    /** Terminal ID / Mã Website — nhận từ VNPay khi đăng ký merchant, : Giống như "Username" của cửa hàng bạn trên hệ thống VNPay. */
    private String tmnCode;

    /** Secret Key / Chuỗi bí mật — dùng để tạo HMAC-SHA512 checksum
     * Khi bạn gửi thông tin đơn hàng (ví dụ 100k) sang VNPay, bạn dùng chuỗi này để mã hóa (tạo checksum).
     * VNPay sẽ dùng đúng chuỗi này để giải mã. Nhờ vậy, nếu hacker có can thiệp đổi URL thành 10k,
     * VNPay sẽ phát hiện ra chữ ký không khớp và từ chối giao dịch ngay.
     * */
    private String hashSecret;

    // Nhóm Điều hướng URLs (Quan trọng)
    /** URL thanh toán — redirect user đến cổng thanh toán VNPay, Cái cổng để  "hất" user sang trang nhập thẻ của VNPay. */
    private String paymentUrl = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";

    /**
     * Return URL — VNPay redirect user về đây sau khi thanh toán xong.
     * Frontend nhận kết quả hiển thị cho user (không bảo đảm 100% reliable —
     * phải dùng IPN để cập nhật trạng thái order).
     */
    private String returnUrl = "http://localhost:5173/payment/result";

    /**
     * API URL truy vấn kết quả giao dịch (QueryDR).
     * Dùng khi IPN không đến sau N phút. Dành cho tính năng QueryDR (truy vấn trạng thái). Nếu user thanh toán xong mà rớt mạng,
     * VNPay không gọi được IPN về server của bạn, thì bạn dùng API này để chủ động hỏi VNPay: "Đơn hàng ABC này đã thu tiền thành công chưa?
     */
    private String apiUrl = "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction";


    // Nhóm Cấu hình mặc định (Ít quan trọng, mang tính thủ tục)
    /** VNPay API version — giữ nguyên "2.1.0" */
    private String version = "2.1.0";

    /** Command — luôn là "pay" cho thanh toán thông thường */
    private String command = "pay";

    /** Locale — "vn" hoặc "en" */
    private String locale = "vn";

    /** Currency code  */
    private String currencyCode = "VND";
}
