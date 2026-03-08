package com.flashticket.core.payment.gateway;

import java.util.Map;

/**
 * VNPay IPN Response Codes — dùng cho IPN handler response.
 * <p>
 * VNPay yêu cầu IPN endpoint trả JSON format:
 * <pre>{"RspCode":"00","Message":"Confirm Success"}</pre>
 * <p>
 * Nếu response code != "00" hoặc timeout > 3s, VNPay sẽ retry IPN.
 * <p>
 * Tham khảo: <a href="https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html#ipn-url">VNPay IPN Doc</a>
 *
 */
public enum VNPayResponseCode {

    SUCCESS("00", "Confirm Success"),
    ORDER_NOT_FOUND("01", "Order not found"),
    ORDER_ALREADY_CONFIRMED("02", "Order already confirmed"),
    INVALID_AMOUNT("04", "Invalid amount"),
    SIGNATURE_FAILED("97", "Invalid signature"),
    UNKNOWN_ERROR("99", "Unknown error");

    private final String code;
    private final String message;

    VNPayResponseCode(String code, String message) {
        this.code = code;
        this.message = message;
    }

    public String getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }

    /**
     * Build IPN response map — VNPay yêu cầu format {"RspCode":"XX","Message":"..."}
     */
    public Map<String, String> toResponse() {
        return Map.of("RspCode", code, "Message", message);
    }
}
