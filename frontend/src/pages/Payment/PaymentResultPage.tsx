import { useEffect, useState, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  paymentService,
  PaymentStatusResponse,
} from "../../services/paymentService";
import { CheckCircle, XCircle, Home, Ticket } from "lucide-react";

interface DisplayResult {
  success: boolean;
  orderNumber?: string;
  transactionNumber?: string;
  amount?: number;
  message?: string;
}

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<DisplayResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const vnpResponseCode = searchParams.get("vnp_ResponseCode");
    const vnpAmount = searchParams.get("vnp_Amount");
    const orderId = sessionStorage.getItem("lastOrderId");
    const orderNumber = sessionStorage.getItem("lastOrderNumber");

    // If no VNPay params and no saved order, nothing to show
    if (!vnpResponseCode && !orderId) {
      setResult({ success: false, message: "Không có dữ liệu thanh toán." });
      setIsLoading(false);
      return;
    }

    // Quick display from VNPay redirect params
    const quickSuccess = vnpResponseCode === "00";
    const quickAmount = vnpAmount ? parseInt(vnpAmount) / 100 : undefined;

    // If we have orderId, poll backend for confirmed status
    if (orderId) {
      let attempts = 0;
      const maxAttempts = 10;

      const pollStatus = async () => {
        try {
          const status: PaymentStatusResponse =
            await paymentService.getPaymentStatus(orderId);

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
                : `Thanh toán không thành công (${status.orderStatus}). Vui lòng thử lại.`,
            });
            setIsLoading(false);
            sessionStorage.removeItem("lastOrderId");
            sessionStorage.removeItem("lastOrderNumber");
            return;
          }
          attempts++;
        } catch (err) {
          console.error("Failed to poll payment status:", err);
          clearInterval(pollRef.current);
          const status = (err as any)?.response?.status;
          const unavailableMessage =
            "Hệ thống thanh toán đang xử lý chậm. Vui lòng vào Đơn hàng của tôi để kiểm tra lại sau.";
          // Fallback to VNPay params
          setResult({
            success: quickSuccess && status !== 503,
            orderNumber: orderNumber || undefined,
            amount: quickAmount,
            message:
              status === 503
                ? unavailableMessage
                : quickSuccess
                  ? "Thanh toán thành công!"
                  : "Thanh toán không thành công. Vui lòng thử lại.",
          });
          setIsLoading(false);
        }
      };

      // First poll immediately, then every 3 seconds
      pollStatus();
      pollRef.current = setInterval(pollStatus, 3000);
    } else {
      // No orderId saved, use VNPay params only
      setResult({
        success: quickSuccess,
        amount: quickAmount,
        message: quickSuccess
          ? "Thanh toán thành công!"
          : "Thanh toán không thành công. Vui lòng thử lại.",
      });
      setIsLoading(false);
    }

    return () => clearInterval(pollRef.current);
  }, [searchParams]);

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
        {/* Icon */}
        <div
          className={`result-icon ${result.success ? "success" : "failure"}`}
        >
          {result.success ? <CheckCircle size={48} /> : <XCircle size={48} />}
        </div>

        {/* Title */}
        <h1
          className={`result-title ${result.success ? "success" : "failure"}`}
        >
          {result.success ? "Thanh toán thành công!" : "Thanh toán thất bại"}
        </h1>

        <p className="result-subtitle">
          {result.success
            ? "Vé của bạn đã được xác nhận. Chúng tôi đã gửi thông tin vé đến email của bạn."
            : result.message ||
              "Đã có lỗi xảy ra trong quá trình thanh toán. Vui lòng thử lại hoặc liên hệ hỗ trợ."}
        </p>

        {/* Order Info */}
        {(result.orderNumber || result.amount) && (
          <div className="result-order-info">
            {result.orderNumber && (
              <div className="info-row">
                <span className="label">Mã đơn hàng</span>
                <span className="value">{result.orderNumber}</span>
              </div>
            )}
            {result.transactionNumber && (
              <div className="info-row">
                <span className="label">Mã giao dịch</span>
                <span className="value">{result.transactionNumber}</span>
              </div>
            )}
            {result.amount !== undefined && (
              <div className="info-row total">
                <span className="label">Số tiền</span>
                <span className="value">
                  {result.amount.toLocaleString("vi-VN")} đ
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="result-actions">
          <Link to="/" className="btn btn-outline">
            <Home size={16} />
            Về trang chủ
          </Link>
          {result.success && (
            <Link to="/my-tickets" className="btn btn-primary">
              <Ticket size={16} />
              Xem vé của tôi
            </Link>
          )}
          {!result.success && (
            <button
              className="btn btn-primary"
              onClick={() => window.history.back()}
            >
              Thử lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
