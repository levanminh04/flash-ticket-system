import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { paymentService } from "../../services/paymentService";
import { PaymentResult as PaymentResultType } from "../../types/api";
import { CheckCircle, XCircle, Home, Ticket } from "lucide-react";

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<PaymentResultType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const queryString = searchParams.toString();

    if (!queryString) {
      setResult({ success: false, message: "Không có dữ liệu thanh toán." });
      setIsLoading(false);
      return;
    }

    // Call backend to verify VNPay callback
    paymentService
      .getPaymentResult(queryString)
      .then((data) => {
        setResult(data);
      })
      .catch((err) => {
        console.error("Failed to verify payment:", err);
        // Fallback: parse VNPay params directly
        const responseCode = searchParams.get("vnp_ResponseCode");
        const txnRef = searchParams.get("vnp_TxnRef");
        const amount = searchParams.get("vnp_Amount");

        setResult({
          success: responseCode === "00",
          orderNumber: txnRef || undefined,
          amount: amount ? parseInt(amount) / 100 : undefined,
          message:
            responseCode === "00"
              ? "Thanh toán thành công!"
              : "Thanh toán không thành công. Vui lòng thử lại.",
        });
      })
      .finally(() => setIsLoading(false));
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
