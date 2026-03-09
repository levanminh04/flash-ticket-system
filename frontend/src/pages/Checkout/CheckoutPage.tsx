import {
  useEffect,
  useState,
  useRef,
  useCallback,
  type MouseEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { useKeycloak } from "@react-keycloak/web";
import {
  bookingService,
  CreateBookingRequest,
  BookingItemRequest,
} from "../../services/bookingService";
import { paymentService } from "../../services/paymentService";
import { EventSummary, TicketType } from "../../types/api";
import { Clock, User, Tag, CreditCard, AlertTriangle } from "lucide-react";

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { keycloak, initialized } = useKeycloak();

  // Data from session
  const [bookingItems, setBookingItems] = useState<BookingItemRequest[]>([]);
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);

  // Form
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Voucher
  const [voucherCode, setVoucherCode] = useState("");

  // Countdown (client-side 15 min)
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Submit
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Load session data ──────────────────────────────────
  useEffect(() => {
    const itemsData = sessionStorage.getItem("bookingItems");
    const eventData = sessionStorage.getItem("bookingEvent");
    const typesData = sessionStorage.getItem("bookingTicketTypes");

    if (!itemsData || !eventData) {
      navigate("/");
      return;
    }

    const items = JSON.parse(itemsData) as BookingItemRequest[];
    const evt = JSON.parse(eventData) as EventSummary;
    const types = typesData ? (JSON.parse(typesData) as TicketType[]) : [];

    setBookingItems(items);
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

    // Setup client-side countdown (15 min)
    const expiresAt = Date.now() + 15 * 60 * 1000;
    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setTimeLeft(diff);
      if (diff <= 0) {
        clearInterval(timerRef.current);
        alert("Thời gian đã hết! Vui lòng chọn vé lại.");
        sessionStorage.removeItem("bookingItems");
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
  const isLowTime = timeLeft <= 120;

  // ─── Subtotal computed from items + ticket types ────────
  const subtotal = bookingItems.reduce((sum, item) => {
    const tt = ticketTypes.find((t) => t.id === item.ticketTypeId);
    return sum + (tt?.price || 0) * item.quantity;
  }, 0);

  // ─── Validate Form ──────────────────────────────────────
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!customerName.trim()) errors.customerName = "Vui lòng nhập họ tên";

    if (!customerEmail.trim()) {
      errors.customerEmail = "Vui lòng nhập email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      errors.customerEmail = "Email không hợp lệ";
    }

    const rawPhone = customerPhone.replace(/\s/g, "");
    if (!rawPhone) {
      errors.customerPhone = "Vui lòng nhập số điện thoại";
    } else if (!/^(?:\+84|0)[0-9]{8,10}$/.test(rawPhone)) {
      errors.customerPhone =
        "Số điện thoại không hợp lệ (bắt đầu bằng 0 hoặc +84).";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [customerName, customerEmail, customerPhone]);

  // ─── Submit: createBooking → initiatePayment → redirect ─
  const handlePayment = async (e?: MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!validateForm()) return;
    if (!event || bookingItems.length === 0) return;

    setIsSubmitting(true);
    try {
      // 1. Create booking (POST /api/bookings)
      const normalizedPhone = customerPhone.replace(/\s/g, "");

      const bookingRequest: CreateBookingRequest = {
        eventId: event.id,
        items: bookingItems,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: normalizedPhone,
        promotionCode: voucherCode.trim() || undefined,
      };

      let orderId = "";
      let orderNumber = "";
      let paymentUrl = "";

      // Backend source hiện tại: create booking -> initiate payment.
      const booking = await bookingService.createBooking(bookingRequest);
      orderId = booking.orderId;
      orderNumber = booking.orderNumber;

      const payment = await paymentService.initiatePayment(orderId);
      paymentUrl = payment.paymentUrl?.trim() || "";

      // 3. Clean up session
      sessionStorage.removeItem("bookingItems");
      sessionStorage.removeItem("bookingEvent");
      sessionStorage.removeItem("bookingTicketTypes");

      // Save order info for payment result page
      if (orderId) {
        sessionStorage.setItem("lastOrderId", orderId);
      }
      if (orderNumber) {
        sessionStorage.setItem("lastOrderNumber", orderNumber);
      }

      // 4. Redirect to VNPay when URL is available.
      if (paymentUrl) {
        if (/^https?:\/\//i.test(paymentUrl)) {
          window.location.assign(paymentUrl);
        } else {
          navigate(paymentUrl.startsWith("/") ? paymentUrl : `/${paymentUrl}`);
        }
        return;
      }

      // Fallback: still show payment result page if payment URL is missing.
      navigate("/payment-result", {
        replace: true,
        state: { fromCheckout: true },
      });
    } catch (err: any) {
      console.error("Payment error:", err);
      const status = err?.response?.status;
      if (status === 503) {
        alert(
          "Hệ thống thanh toán đang tạm bận (503). Vui lòng thử lại sau vài giây.",
        );
        return;
      }
      if (status === 405) {
        alert(
          "Gateway/backend đang lệch cấu hình endpoint thanh toán (405). Vui lòng thử lại hoặc kiểm tra service backend.",
        );
        return;
      }
      alert(
        err?.response?.data?.message ||
          err?.response?.data?.error?.message ||
          err?.response?.data?.error?.code ||
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

  if (!event || bookingItems.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <p>Đang tải...</p>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <div className="loading-spinner" style={{ margin: "0 auto 16px" }} />
        <p>Đang xác thực đăng nhập...</p>
      </div>
    );
  }

  if (!keycloak?.authenticated) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <p style={{ marginBottom: 8 }}>Phiên đăng nhập chưa sẵn sàng.</p>
        <p
          style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 16 }}
        >
          Vui lòng đăng nhập để tiếp tục thanh toán.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            keycloak?.login({
              redirectUri: window.location.origin + "/checkout",
            });
          }}
        >
          Đăng nhập
        </button>
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
              <span className="countdown-text">
                Thời gian còn lại để hoàn tất
              </span>
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
                  placeholder="Nhập mã voucher (nếu có)"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                />
              </div>

              {voucherCode.trim() && (
                <div
                  className="voucher-result"
                  style={{
                    color: "var(--text-muted)",
                    fontSize: 13,
                    marginTop: 8,
                  }}
                >
                  <span>Mã sẽ được áp dụng khi thanh toán</span>
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
                {bookingItems.map((item, idx) => {
                  const tt = ticketTypes.find(
                    (t) => t.id === item.ticketTypeId,
                  );
                  return (
                    <div key={idx} className="checkout-item">
                      <span className="item-label">
                        {tt?.name || "Vé"} x{item.quantity}
                      </span>
                      <span className="item-value">
                        {((tt?.price || 0) * item.quantity).toLocaleString(
                          "vi-VN",
                        )}{" "}
                        đ
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="checkout-pricing">
                <div className="pricing-row">
                  <span>Tạm tính</span>
                  <span>{subtotal.toLocaleString("vi-VN")} đ</span>
                </div>

                <div className="pricing-row total">
                  <span>Tổng cộng</span>
                  <span className="amount">
                    {subtotal.toLocaleString("vi-VN")} đ
                  </span>
                </div>
              </div>

              <button
                type="button"
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
                    Thanh toán {subtotal.toLocaleString("vi-VN")} đ
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
