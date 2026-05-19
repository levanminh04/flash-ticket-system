import { useEffect, useRef, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Home, LoaderCircle, X } from "lucide-react";
import AccountCategoryNav from "../../components/common/AccountCategoryNav";
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

function extractOrderNumber(orderInfo: string | null) {
  return orderInfo?.match(/ORD-[A-Z0-9-]+/i)?.[0];
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
    const vnpOrderInfo = params.get("vnp_OrderInfo");
    const vnpTransactionNo = params.get("vnp_TransactionNo");
    const vnpTxnRef = params.get("vnp_TxnRef");
    const orderId = sessionStorage.getItem("lastOrderId");
    const orderNumber =
      sessionStorage.getItem("lastOrderNumber") || extractOrderNumber(vnpOrderInfo);
    const transactionNumber = vnpTxnRef || vnpTransactionNo || undefined;

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);

      if (!vnpResponseCode && !orderId) {
        setResult({
          success: false,
          message: "Không có dữ liệu thanh toán.",
        });
        setIsLoading(false);
        return;
      }

      const quickSuccess = vnpResponseCode === "00";
      const quickAmount = vnpAmount ? parseInt(vnpAmount, 10) / 100 : undefined;

      if (!orderId) {
        setResult({
          success: false,
          orderNumber: orderNumber || undefined,
          transactionNumber,
          amount: quickAmount,
          message: quickSuccess
            ? "Vui lòng kiểm tra lại trong Đơn hàng của tôi."
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
              transactionNumber: latestTx?.transactionNumber || transactionNumber,
              amount: Number(status.totalAmount) || quickAmount,
              message: isConfirmed
                ? "Thanh toán thành công!"
                : `Thanh toán chưa được backend xác nhận (${status.orderStatus}). Vui lòng kiểm tra lại trong Đơn hàng của tôi.`,
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
      <>
        <AccountCategoryNav />
        <div className="payment-result-page payment-result-loading-page">
          <div className="payment-result-page-loading" role="status" aria-live="polite">
            <LoaderCircle className="payment-result-loading-icon" size={32} />
            <h1>Đang xác nhận thanh toán</h1>
            <p>Vui lòng chờ trong giây lát, hệ thống đang đối soát kết quả từ VNPay.</p>
          </div>
        </div>
      </>
    );
  }

  if (!result) {
    return (
      <>
        <AccountCategoryNav />
        <div className="payment-result-page">
          <div className="result-card">
            <p>Không có thông tin kết quả thanh toán.</p>
            <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>
              Về trang chủ
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AccountCategoryNav />
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
    </>
  );
}
