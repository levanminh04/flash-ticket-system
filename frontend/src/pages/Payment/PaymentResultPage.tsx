import { useEffect, useRef, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Home, X } from "lucide-react";
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
    const orderId = sessionStorage.getItem("lastOrderId");
    const orderNumber = sessionStorage.getItem("lastOrderNumber");

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);

      if (!vnpResponseCode && !orderId) {
        setResult({
          success: false,
          message: "Khong co du lieu thanh toan.",
        });
        setIsLoading(false);
        return;
      }

      const quickSuccess = vnpResponseCode === "00";
      const quickAmount = vnpAmount ? parseInt(vnpAmount, 10) / 100 : undefined;

      if (!orderId) {
        setResult({
          success: false,
          amount: quickAmount,
          message: quickSuccess
            ? "Da nhan redirect tu VNPay, nhung khong tim thay ma don hang trong phien de doi soat. Vui long kiem tra lai trong Don hang cua toi."
            : "Thanh toan khong thanh cong. Vui long thu lai.",
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
            "Phien dang nhap da het. Vui long dang nhap lai de he thong xac nhan trang thai thanh toan.",
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
                ? "Thanh toan thanh cong!"
                : `Thanh toan chua duoc backend xac nhan (${status.orderStatus}). Vui long kiem tra lai trong Don hang cua toi.`,
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
              ? "Khong the xac nhan don hang vi phien dang nhap khong hop le. Vui long dang nhap lai va kiem tra Don hang cua toi."
              : statusCode === 503
                ? "He thong thanh toan dang xu ly cham. Vui long kiem tra lai trong Don hang cua toi sau it phut."
                : "Khong the xac nhan trang thai thanh toan luc nay. Vui long kiem tra lai trong Don hang cua toi.";

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
            <div className="loading-text">Dang xac nhan thanh toan...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="payment-result-page">
        <div className="result-card">
          <p>Khong co thong tin ket qua thanh toan.</p>
          <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>
            Ve trang chu
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
          {result.success ? "Thanh toan thanh cong!" : "Thanh toan that bai"}
        </h1>

        <p className="result-subtitle">
          {result.success
            ? "Chung toi da gui thong tin ve den email cua ban."
            : result.message ||
              "Da co loi xay ra trong qua trinh thanh toan. Vui long thu lai hoac lien he ho tro."}
        </p>

        {result.orderNumber || result.amount !== undefined ? (
          <div className="result-order-info">
            {result.orderNumber ? (
              <div className="info-row">
                <span className="label">Ma don hang</span>
                <span className="value">{result.orderNumber}</span>
              </div>
            ) : null}
            {result.transactionNumber ? (
              <div className="info-row">
                <span className="label">Ma giao dich</span>
                <span className="value">{result.transactionNumber}</span>
              </div>
            ) : null}
            {result.amount !== undefined ? (
              <div className="info-row total">
                <span className="label">So tien</span>
                <span className="value">
                  {result.amount.toLocaleString("vi-VN")} d
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="result-actions">
          <Link to="/" className="btn btn-outline">
            <Home size={16} />
            Ve trang chu
          </Link>
          {result.success ? (
            <Link to="/my-tickets" className="btn btn-primary">
              Xem ve cua toi
            </Link>
          ) : (
            <Link to="/my-orders" className="btn btn-primary">
              Kiem tra don hang
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
