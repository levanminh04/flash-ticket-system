import { useEffect, useRef, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Home, X } from "lucide-react";
import axiosClient from "../../lib/axiosClient";
import {
  paymentService,
  PaymentStatusResponse,
} from "../../services/paymentService";

interface DisplayResult {
  success: boolean;
  orderNumber?: string;
  transactionNumber?: string;
  amount?: number;
  message?: string;
}

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const { initialized, keycloak } = useKeycloak();
  const [result, setResult] = useState<DisplayResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const paymentQuery = searchParams.toString();

  useEffect(() => {
    if (!initialized) return;

    const params = new URLSearchParams(paymentQuery);
    const vnpResponseCode = params.get("vnp_ResponseCode");
    const vnpAmount = params.get("vnp_Amount");
    const hasTxnRef = Boolean(params.get("vnp_TxnRef"));
    const hasSecureHash = Boolean(params.get("vnp_SecureHash"));
    const orderId = sessionStorage.getItem("lastOrderId");
    const orderNumber = sessionStorage.getItem("lastOrderNumber");

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      if (!vnpResponseCode && !orderId) {
        setResult({ success: false, message: "Không có dữ liệu thanh toán." });
        setIsLoading(false);
        return;
      }

      const quickSuccess = vnpResponseCode === "00";
      const quickAmount = vnpAmount ? parseInt(vnpAmount, 10) / 100 : undefined;

      // Local/dev fallback:
      // khi VNPay không gọi được IPN vào localhost, frontend chủ động forward callback params về backend 1 lần.
      if (hasTxnRef && hasSecureHash) {
        try {
          await axiosClient.get(`/api/payments/vnpay-ipn?${paymentQuery}`);
        } catch (error) {
          // Không chặn luồng polling; có thể callback này đã được xử lý trước đó hoặc bị retry.
          console.warn("Failed to forward VNPay callback from frontend:", error);
        }
      }

      if (!orderId) {
        setResult({
          success: false,
          amount: quickAmount,
          message: quickSuccess
            ? "Đã nhận phản hồi thành công từ VNPay, nhưng không tìm thấy mã đơn hàng trong phiên để đối soát tự động. Vui lòng kiểm tra lại trong Đơn hàng của tôi."
            : "Thanh toán không thành công. Vui lòng thử lại.",
        });
        setIsLoading(false);
        return;
      }

      if (!keycloak.authenticated) {
        setResult({
          success: false,
          orderNumber: orderNumber || undefined,
          amount: quickAmount,
          message:
            "Phiên đăng nhập đã hết. Vui lòng đăng nhập lại để hệ thống xác nhận trạng thái thanh toán.",
        });
        setIsLoading(false);
        return;
      }

      let attempts = 0;
      const maxAttempts = 10;

      const pollStatus = async () => {
        try {
          const status: PaymentStatusResponse =
            await paymentService.getPaymentStatus(orderId);

          if (cancelled) return;

          if (status.orderStatus !== "PENDING" || attempts >= maxAttempts) {
            clearInterval(pollRef.current);
            const isConfirmed = status.orderStatus === "CONFIRMED";
            const latestTx = status.transactions?.[0];

            setResult({
              success: isConfirmed,
              orderNumber: orderNumber || undefined,
              transactionNumber: latestTx?.transactionNumber,
              amount: Number(status.totalAmount) || quickAmount,
              message: isConfirmed
                ? "Thanh toán thành công!"
                : `Thanh toán chưa hoàn tất (${status.orderStatus}). Vui lòng kiểm tra lại trong Đơn hàng của tôi.`,
            });
            setIsLoading(false);
            sessionStorage.removeItem("lastOrderId");
            sessionStorage.removeItem("lastOrderNumber");
            return;
          }

          attempts++;
        } catch (error: any) {
          if (cancelled) return;
          console.error("Failed to poll payment status:", error);
          clearInterval(pollRef.current);

          const statusCode = error?.response?.status;
          const message =
            statusCode === 401 || statusCode === 403
              ? "Không thể xác nhận đơn hàng vì phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại và kiểm tra Đơn hàng của tôi."
              : statusCode === 503
                ? "Hệ thống thanh toán đang xử lý chậm. Vui lòng kiểm tra lại trong Đơn hàng của tôi sau ít phút."
                : "Không thể xác nhận trạng thái thanh toán lúc này. Vui lòng kiểm tra lại trong Đơn hàng của tôi.";

          setResult({
            success: false,
            orderNumber: orderNumber || undefined,
            amount: quickAmount,
            message,
          });
          setIsLoading(false);
        }
      };

      await pollStatus();
      if (!cancelled) {
        pollRef.current = setInterval(pollStatus, 3000);
      }
    };

    void run();

    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
    };
  }, [initialized, keycloak.authenticated, paymentQuery]);

  if (isLoading) {
    return (
      <div className="payment-result-page">
        <div className="result-card">
          <div className="result-loading">
            <div className="loading-spinner"></div>
            <div className="loading-text">Đang xác nhận thanh toán...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="payment-result-page">
        <div className="result-card">
          <p>Không có thông tin kết quả thanh toán.</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-result-page">
      <div
        className={`result-card ${result.success ? "success-state" : ""}`}
        style={{ position: "relative", overflow: "hidden" }}
      >
        <div className={`result-icon ${result.success ? "success" : "failure"}`}>
          {result.success ? (
            <Check size={28} strokeWidth={3.2} />
          ) : (
            <X size={28} strokeWidth={3.2} />
          )}
        </div>

        <h1 className={`result-title ${result.success ? "success" : "failure"}`}>
          {result.success ? "Thanh toán thành công!" : "Thanh toán thất bại"}
        </h1>

        <p className="result-subtitle">
          {result.success
            ? "Chúng tôi đã gửi thông tin vé đến email của bạn."
            : result.message ||
              "Đã có lỗi xảy ra trong quá trình thanh toán. Vui lòng thử lại hoặc liên hệ hỗ trợ."}
        </p>

        {result.orderNumber || result.amount !== undefined ? (
          <div className="result-order-info">
            {result.orderNumber ? (
              <div className="info-row">
                <span className="label">Mã đơn hàng</span>
                <span className="value">{result.orderNumber}</span>
              </div>
            ) : null}
            {result.transactionNumber ? (
              <div className="info-row">
                <span className="label">Mã giao dịch</span>
                <span className="value">{result.transactionNumber}</span>
              </div>
            ) : null}
            {result.amount !== undefined ? (
              <div className="info-row total">
                <span className="label">Số tiền</span>
                <span className="value">
                  {result.amount.toLocaleString("vi-VN")} đ
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="result-actions">
          <Link to="/" className="btn btn-outline">
            <Home size={16} />
            Về trang chủ
          </Link>
          {result.success ? (
            <Link to="/my-tickets" className="btn btn-primary">
              Xem vé của tôi
            </Link>
          ) : (
            <Link to="/my-orders" className="btn btn-primary">
              Kiểm tra đơn hàng
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
