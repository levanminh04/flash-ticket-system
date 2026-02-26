package com.flashticket.core.payment.gateway;

import java.math.BigDecimal;
import java.util.Map;

/**
 * Strategy interface cho Payment Gateway.
 * <p>
 * Cho phép dễ dàng mở rộng sang MoMo, ZaloPay, etc. mà không sửa PaymentService.
 * <p>
 * VNPayGateway implements PaymentGateway   — Phase 2B (hiện tại)
 * MomoGateway   implements PaymentGateway   — Phase tương lai
 * không chứa logic code nào cả,  chỉ đặt ra luật chơi: "Bất kỳ cổng thanh toán nào muốn gia nhập hệ thống này đều BẮT BUỘC phải làm được 3 việc:
 * Tạo URL thanh toán (createPaymentUrl),
 * Xác thực chữ ký (verifyCallback),
 * và Trích xuất kết quả (parseCallbackResult)
 */
public interface PaymentGateway {

    /**
     * Tạo redirect URL để user trả tiền trên cổng thanh toán.
     *
     * @param request   Thông tin thanh toán (transaction number, amount, order info)
     * @param ipAddress IP client — VNPay yêu cầu để fraud detection - ví dụ: thẻ ở VN nhưng IP ở Châu Phi thì họ sẽ chặn.
     * @return Payment URL đầy đủ, đã ký HMAC
     */
    String createPaymentUrl(PaymentRequest request, String ipAddress);

    /**
     * Verify HMAC-SHA512 signature từ VNPay callback params.
     * <p>
     * Phải verify TRƯỚC khi xử lý IPN để tránh giả mạo. Khi VNPay gọi IPN trả kết quả về cho bạn,
     * hacker có thể giả mạo một request đến server của bạn với nội dung: "Đơn 100 triệu này thanh toán thành công rồi nhé".
     * Hàm này sẽ dùng hashSecret (chữ ký bí mật) để kiểm tra xem request đó có đúng là của VNPay gửi hay không.
     *
     * @param params Tất cả params VNPay gửi về (vnp_SecureHash included)
     * @return true nếu signature hợp lệ
     */
    boolean verifyCallback(Map<String, String> params);

    /**
     * Parse kết quả thanh toán từ VNPay callback params.
     * <p>
     * Chỉ gọi sau khi verifyCallback() trả true.
     *
     * @param params Tất cả params VNPay gửi về
     * @return PaymentResult chứa responseCode, amount, bank info, etc.
     */
    PaymentResult parseCallbackResult(Map<String, String> params);

    // ────────────────────────────────────────────────────────────────────────────
    // Inner types — request/result DTOs
    // ────────────────────────────────────────────────────────────────────────────

    /**
     * Dữ liệu đầu vào khi tạo payment URL. Đây là cấu trúc chứa những thông tin tối thiểu và trung lập nhất mà BẤT KỲ cổng thanh toán nào cũng bắt buộc phải có để thu được tiền.
     *
     * @param transactionNumber Mã giao dịch của hệ thống (dùng làm vnp_TxnRef)
     * @param amount            Số tiền VND (không nhân 100 — gateway sẽ tự nhân)
     * @param orderInfo         Mô tả hiển thị trên trang VNPay (max 255 chars)
     * @param bankCode          Optional: chỉ định ngân hàng (NCB, VCB...) — null = user chọn
     */
    record PaymentRequest(
        String transactionNumber,
        BigDecimal amount,
        String orderInfo,
        String bankCode
    ) {}

    /**
     * Kết quả parse từ VNPay callback. Mỗi cổng thanh toán trả về kết quả một kiểu. VNPay trả về chữ vnp_ResponseCode="00",
     * Stripe trả về status="succeeded", MoMo trả về resultCode=0. Cấu trúc này dùng để "dịch" tất cả các ngôn ngữ đó ra một ngôn ngữ chung để hệ thống mình hiểu.
     *
     * @param transactionNumber  Mã giao dịch hệ thống (vnp_TxnRef)
     * @param providerTransactionId VNPay transaction ID (vnp_TransactionNo)
     * @param responseCode       "00" = success, các code khác = lỗi cụ thể
     * @param amount             Số tiền thực tế VNPay confirm (đã chia 100)
     * @param bankCode           Ngân hàng thực hiện
     * @param cardType           ATM / Credit
     * @param rawParams          Toàn bộ params gốc — lưu vào DB để audit
     */
    record PaymentResult(
        String transactionNumber,
        String providerTransactionId,
        String responseCode,
        BigDecimal amount,
        String bankCode,
        String cardType,
        Map<String, String> rawParams
    ) {
        /** @return true nếu thanh toán thành công */
        public boolean isSuccess() {
            return "00".equals(responseCode);
        }
    }
}
