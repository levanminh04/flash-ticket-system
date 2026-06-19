import { useEffect, useRef, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Home, LoaderCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
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

function formatCurrency(value: number, language: string) {
  return `${value.toLocaleString(language === "en" ? "en-US" : "vi-VN")} đ`;
}

function extractVNPayParams(params: URLSearchParams) {
  const callbackParams: Record<string, string> = {};
  params.forEach((value, key) => {
    if (key.startsWith("vnp_")) {
      callbackParams[key] = value;
    }
  });
  return callbackParams;
}

function hasVNPayCallback(params: Record<string, string>) {
  return Boolean(
    params.vnp_TxnRef &&
      params.vnp_SecureHash &&
      params.vnp_ResponseCode &&
      params.vnp_Amount,
  );
}

export default function PaymentResultPage() {
  const { i18n, t } = useTranslation();
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
          message: t("paymentResult.missingData"),
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
            ? t("paymentResult.quickCheckOrders")
            : t("paymentResult.quickFailure"),
        });
        setIsLoading(false);
        return;
      }

      if (!keycloak.authenticated) {
        setResult({
          success: false,
          orderNumber: orderNumber || undefined,
          amount: quickAmount,
          message: t("paymentResult.loginExpired"),
        });
        setIsLoading(false);
        return;
      }

      const vnpCallbackParams = extractVNPayParams(params);
      if (hasVNPayCallback(vnpCallbackParams)) {
        try {
          const callbackResult =
            await paymentService.confirmVNPayReturn(vnpCallbackParams);

          if (!["00", "02"].includes(callbackResult.RspCode)) {
            console.warn("VNPay callback relay was not accepted:", callbackResult);
          }
        } catch (error) {
          console.error("Failed to relay VNPay callback:", error);
        }
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
                ? t("paymentResult.successMessage")
                : t("paymentResult.statusPending", { status: status.orderStatus }),
            });
            setIsLoading(false);
            sessionStorage.removeItem("lastOrderId");
            sessionStorage.removeItem("lastOrderNumber");
            return;
          }

          const latestTx = status.transactions?.[0];
          if (latestTx && latestTx.status !== "PENDING") {
            clearInterval(pollRef.current);
            setResult({
              success: false,
              orderNumber: orderNumber || undefined,
              transactionNumber: latestTx.transactionNumber || transactionNumber,
              amount: Number(status.totalAmount) || quickAmount,
              message: t("paymentResult.statusPending", { status: latestTx.status }),
            });
            setIsLoading(false);
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
              ? t("paymentResult.pollAuthFailed")
              : statusCode === 503
                ? t("paymentResult.pollDelayed")
                : t("paymentResult.pollFailed");

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
  }, [initialized, keycloak.authenticated, paymentQuery, t]);

  if (isLoading) {
    return (
      <>
        <AccountCategoryNav />
        <div className="payment-result-page payment-result-loading-page">
          <div className="payment-result-page-loading" role="status" aria-live="polite">
            <LoaderCircle className="payment-result-loading-icon" size={32} />
            <h1>{t("paymentResult.loadingTitle")}</h1>
            <p>{t("paymentResult.loadingSubtitle")}</p>
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
            <p>{t("paymentResult.noResult")}</p>
            <Link to="/" className="btn btn-primary" style={{ marginTop: 16 }}>
              {t("paymentResult.home")}
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
            {result.success ? t("paymentResult.successTitle") : t("paymentResult.failureTitle")}
          </h1>

          <p className="result-subtitle">
            {result.success
              ? t("paymentResult.successSubtitle")
              : result.message || t("paymentResult.failureSubtitle")}
          </p>

          {result.orderNumber || result.amount !== undefined ? (
            <div className="result-order-info">
              {result.orderNumber ? (
                <div className="info-row">
                  <span className="label">{t("paymentResult.orderNumber")}</span>
                  <span className="value">{result.orderNumber}</span>
                </div>
              ) : null}
              {result.transactionNumber ? (
                <div className="info-row">
                  <span className="label">{t("paymentResult.transactionNumber")}</span>
                  <span className="value">{result.transactionNumber}</span>
                </div>
              ) : null}
              {result.amount !== undefined ? (
                <div className="info-row total">
                  <span className="label">{t("paymentResult.amount")}</span>
                  <span className="value">
                    {formatCurrency(result.amount, i18n.resolvedLanguage || "vi")}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="result-actions">
            <Link to="/" className="btn btn-outline">
              <Home size={16} />
              {t("paymentResult.home")}
            </Link>
            {result.success ? (
              <Link to="/my-tickets" className="btn btn-primary">
                {t("paymentResult.viewTickets")}
              </Link>
            ) : (
              <Link to="/my-orders" className="btn btn-primary">
                {t("paymentResult.checkOrders")}
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
