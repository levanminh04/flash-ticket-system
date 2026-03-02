import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useKeycloak } from "@react-keycloak/web";
import {
  bookingService,
  CreateOrderRequest,
} from "../../services/bookingService";
import { paymentService } from "../../services/paymentService";
import { promotionService } from "../../services/promotionService";
import {
  EventSummary,
  Reservation,
  TicketType,
  PromotionValidation,
} from "../../types/api";
import {
  Clock,
  User,
  Tag,
  CreditCard,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { keycloak } = useKeycloak();

  // Data from session
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]); // eslint-disable-line @typescript-eslint/no-unused-vars

  // Form
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Voucher
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherResult, setVoucherResult] =
    useState<PromotionValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Countdown
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Submit
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Load session data ──────────────────────────────────
  useEffect(() => {
    const resData = sessionStorage.getItem("reservation");
    const eventData = sessionStorage.getItem("bookingEvent");
    const typesData = sessionStorage.getItem("bookingTicketTypes");

    if (!resData || !eventData) {
      navigate("/");
      return;
    }

    const res = JSON.parse(resData) as Reservation;
    const evt = JSON.parse(eventData) as EventSummary;
    const types = typesData ? (JSON.parse(typesData) as TicketType[]) : [];

    setReservation(res);
    setEvent(evt);
    setTicketTypes(types);

    // Pre-fill from keycloak
    if (keycloak?.tokenParsed) {
      setCustomerName(
        keycloak.tokenParsed.name ||
          `${keycloak.tokenParsed.given_name || ""} ${keycloak.tokenParsed.family_name || ""}`.trim(),
      );
      setCustomerEmail(keycloak.tokenParsed.email || "");
    }

    // Setup countdown
    const expiresAt = new Date(res.expiresAt).getTime();
    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(diff);
      if (diff <= 0) {
        clearInterval(timerRef.current);
        alert("Thời gian giữ chỗ đã hết! Vui lòng chọn vé lại.");
        sessionStorage.removeItem("reservation");
        navigate(-1);
      }
    };
    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => clearInterval(timerRef.current);
  }, [navigate, keycloak]);

  // ─── Countdown display ──────────────────────────────────
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const countdownStr = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  const isLowTime = timeLeft <= 120; // less than 2 minutes

  // ─── Subtotal and discount ──────────────────────────────
  const subtotal = reservation?.totalAmount || 0;
  const discountAmount = voucherResult?.valid
    ? voucherResult.calculatedDiscount || 0
    : 0;
  const totalAmount = Math.max(0, subtotal - discountAmount);

  // ─── Validate Form ──────────────────────────────────────
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!customerName.trim()) errors.customerName = "Vui lòng nhập họ tên";
    if (!customerEmail.trim()) {
      errors.customerEmail = "Vui lòng nhập email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      errors.customerEmail = "Email không hợp lệ";
    }
    if (!customerPhone.trim()) {
      errors.customerPhone = "Vui lòng nhập số điện thoại";
    } else if (!/^[0-9]{9,11}$/.test(customerPhone.replace(/\s/g, ""))) {
      errors.customerPhone = "Số điện thoại không hợp lệ";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [customerName, customerEmail, customerPhone]);

  // ─── Voucher Validation ─────────────────────────────────
  const handleValidateVoucher = async () => {
    if (!voucherCode.trim()) return;
    setIsValidating(true);
    try {
      const result = await promotionService.validateVoucher(
        voucherCode.trim().toUpperCase(),
        event!.id,
        subtotal,
      );
      setVoucherResult(result);
    } catch (err: any) {
      setVoucherResult({
        valid: false,
        message: err.response?.data?.message || "Mã voucher không hợp lệ.",
      });
    } finally {
      setIsValidating(false);
    }
  };

  // ─── Submit Payment ─────────────────────────────────────
  const handlePayment = async () => {
    if (!validateForm()) return;
    if (!reservation) return;

    setIsSubmitting(true);
    try {
      // 1. Create order
      const orderData: CreateOrderRequest = {
        reservationId: reservation.id,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.trim(),
        promotionCode: voucherResult?.valid
          ? voucherCode.trim().toUpperCase()
          : undefined,
      };

      const order = await bookingService.createOrder(orderData);

      // 2. Get VNPay URL
      const paymentData = await paymentService.createPaymentUrl(order.id);

      // 3. Clean up session
      sessionStorage.removeItem("reservation");
      sessionStorage.removeItem("bookingEvent");
      sessionStorage.removeItem("bookingTicketTypes");

      // 4. Redirect to VNPay
      window.location.href = paymentData.paymentUrl;
    } catch (err: any) {
      console.error("Payment error:", err);
      alert(
        err.response?.data?.message ||
          "Có lỗi xảy ra khi tạo thanh toán. Vui lòng thử lại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Banner URL ─────────────────────────────────────────
  const bannerUrl =
    (event as any)?.images?.find((i: any) => i.type === "BANNER")?.url ||
    (event as any)?.bannerUrl;
  const startDate = event?.startDatetime
    ? new Date((event as any)?.schedule?.startDatetime || event.startDatetime)
    : null;

  if (!reservation || !event) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <p>Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      {/* FOCUS HEADER */}
      <div className="booking-focus-header">
        <div className="container">
          <div className="focus-event-info">
            {bannerUrl && (
              <img src={bannerUrl} alt="" className="event-thumb" />
            )}
            <div>
              <div className="event-name">{event.title}</div>
              {startDate && (
                <div className="event-date">
                  {startDate.toLocaleDateString("vi-VN", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="step-indicator">
            <div className="step-item completed">
              <span className="step-number">✓</span>
              <span>Chọn vé</span>
            </div>
            <div className="step-divider"></div>
            <div className="step-item active">
              <span className="step-number">2</span>
              <span>Thanh toán</span>
            </div>
            <div className="step-divider"></div>
            <div className="step-item">
              <span className="step-number">3</span>
              <span>Kết quả</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div className="container">
        <div className="checkout-layout">
          {/* LEFT: Form */}
          <div>
            {/* Countdown */}
            <div className={`countdown-box ${isLowTime ? "warning" : ""}`}>
              <Clock size={20} className="countdown-icon" />
              <span className="countdown-time">{countdownStr}</span>
              <span className="countdown-text">Thời gian giữ chỗ còn lại</span>
              {isLowTime && <AlertTriangle size={16} />}
            </div>

            {/* Customer Info */}
            <div className="checkout-form-section">
              <h2>
                <User
                  size={20}
                  style={{ marginRight: 8, verticalAlign: "middle" }}
                />
                Thông tin người mua
              </h2>

              <div className="form-group">
                <label>
                  Họ và tên <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className={`form-input ${formErrors.customerName ? "error" : ""}`}
                  placeholder="Nhập họ và tên"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
                {formErrors.customerName && (
                  <div className="form-error">{formErrors.customerName}</div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    Email <span className="required">*</span>
                  </label>
                  <input
                    type="email"
                    className={`form-input ${formErrors.customerEmail ? "error" : ""}`}
                    placeholder="example@email.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                  {formErrors.customerEmail && (
                    <div className="form-error">{formErrors.customerEmail}</div>
                  )}
                </div>

                <div className="form-group">
                  <label>
                    Số điện thoại <span className="required">*</span>
                  </label>
                  <input
                    type="tel"
                    className={`form-input ${formErrors.customerPhone ? "error" : ""}`}
                    placeholder="09xx xxx xxx"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                  {formErrors.customerPhone && (
                    <div className="form-error">{formErrors.customerPhone}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Voucher */}
            <div className="voucher-section">
              <h2>
                <Tag
                  size={20}
                  style={{ marginRight: 8, verticalAlign: "middle" }}
                />
                Mã giảm giá
              </h2>

              <div className="voucher-input-group">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nhập mã voucher"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleValidateVoucher()
                  }
                />
                <button
                  className="btn btn-primary btn-apply"
                  onClick={handleValidateVoucher}
                  disabled={!voucherCode.trim() || isValidating}
                >
                  {isValidating ? "Đang kiểm tra..." : "Áp dụng"}
                </button>
              </div>

              {voucherResult && (
                <div
                  className={`voucher-result ${voucherResult.valid ? "success" : "error"}`}
                >
                  {voucherResult.valid ? (
                    <>
                      <CheckCircle size={16} />
                      <span>
                        Áp dụng thành công! Giảm{" "}
                        {voucherResult.discountType === "PERCENTAGE"
                          ? `${voucherResult.discountValue}%`
                          : `${voucherResult.calculatedDiscount?.toLocaleString("vi-VN")} đ`}
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle size={16} />
                      <span>
                        {voucherResult.message || "Mã voucher không hợp lệ"}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Order Summary */}
          <div className="checkout-summary">
            <div className="checkout-summary-card">
              <h3>Chi tiết đơn hàng</h3>

              <div className="checkout-event-info">
                {bannerUrl && <img src={bannerUrl} alt="" />}
                <div>
                  <div className="event-title">{event.title}</div>
                  {startDate && (
                    <div className="event-meta">
                      {startDate.toLocaleDateString("vi-VN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                  )}
                  <div className="event-meta">
                    {(event as any)?.venue?.name || (event as any)?.venueName}
                  </div>
                </div>
              </div>

              <div className="checkout-items">
                {reservation.items.map((item, idx) => (
                  <div key={idx} className="checkout-item">
                    <span className="item-label">
                      {item.ticketTypeName} x{item.quantity}
                    </span>
                    <span className="item-value">
                      {(item.unitPrice * item.quantity).toLocaleString("vi-VN")}{" "}
                      đ
                    </span>
                  </div>
                ))}
              </div>

              <div className="checkout-pricing">
                <div className="pricing-row">
                  <span>Tạm tính</span>
                  <span>{subtotal.toLocaleString("vi-VN")} đ</span>
                </div>

                {discountAmount > 0 && (
                  <div className="pricing-row discount">
                    <span>Giảm giá ({voucherCode})</span>
                    <span>-{discountAmount.toLocaleString("vi-VN")} đ</span>
                  </div>
                )}

                <div className="pricing-row total">
                  <span>Tổng cộng</span>
                  <span className="amount">
                    {totalAmount.toLocaleString("vi-VN")} đ
                  </span>
                </div>
              </div>

              <button
                className="btn-pay"
                onClick={handlePayment}
                disabled={isSubmitting || timeLeft <= 0}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner"></span>
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <CreditCard size={18} />
                    Thanh toán {totalAmount.toLocaleString("vi-VN")} đ
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
