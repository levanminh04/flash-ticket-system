import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  type MouseEvent,
} from "react";
import { useNavigate } from "react-router-dom";
import { useKeycloak } from "@react-keycloak/web";
import { toast } from "react-toastify";
import {
  bookingService,
  CreateBookingRequest,
  BookingItemRequest,
} from "../../services/bookingService";
import { paymentService } from "../../services/paymentService";
import { EventSummary, TicketType } from "../../types/api";
import {
  User,
  AlertTriangle,
} from "lucide-react";

function formatCurrency(value: number): string {
  return `${value.toLocaleString("vi-VN")} đ`;
}

function formatTimer(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatSeatLabel(seatId: string): string {
  const match = seatId.match(/-([A-Za-z]+)-(\d+)$/);
  if (match) {
    return `${match[1].toUpperCase()}-${match[2]}`;
  }
  return seatId;
}

function normalizeSeatLabel(value: string): string {
  const trimmed = value.trim();
  const directLabel = trimmed.match(/^([A-Za-z]+)-?(\d+)$/);
  if (directLabel) {
    return `${directLabel[1].toUpperCase()}-${directLabel[2]}`;
  }
  return formatSeatLabel(trimmed);
}

function getSeatLabelsFromSeatIds(seatIds?: string[]): string[] {
  if (!seatIds || seatIds.length === 0) return [];
  return seatIds.map((seatId) => normalizeSeatLabel(formatSeatLabel(seatId)));
}

function getSeatLabelsFromLabels(labels?: string[]): string[] {
  if (!labels || labels.length === 0) return [];
  return labels.map(normalizeSeatLabel);
}

interface CheckoutSelectedSeat {
  seatId: string;
  ticketTypeId: string;
  seatLabel?: string;
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { keycloak, initialized } = useKeycloak();

  const [bookingItems, setBookingItems] = useState<BookingItemRequest[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<CheckoutSelectedSeat[]>([]);
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [voucherCode, setVoucherCode] = useState("");
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eventImageIndex, setEventImageIndex] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    const itemsData = sessionStorage.getItem("bookingItems");
    const eventData = sessionStorage.getItem("bookingEvent");
    const typesData = sessionStorage.getItem("bookingTicketTypes");
    const selectedSeatsData = sessionStorage.getItem("bookingSelectedSeats");

    if (!itemsData || !eventData) {
      navigate("/");
      return;
    }

    const items = JSON.parse(itemsData) as BookingItemRequest[];
    const selectedEvent = JSON.parse(eventData) as EventSummary;
    const types = typesData ? (JSON.parse(typesData) as TicketType[]) : [];
    const parsedSelectedSeats = selectedSeatsData
      ? (JSON.parse(selectedSeatsData) as CheckoutSelectedSeat[])
      : [];

    setBookingItems(items);
    setSelectedSeats(parsedSelectedSeats);
    setEvent(selectedEvent);
    setTicketTypes(types);

    if (keycloak?.tokenParsed) {
      setCustomerName(
        keycloak.tokenParsed.name ||
          `${keycloak.tokenParsed.given_name || ""} ${keycloak.tokenParsed.family_name || ""}`.trim(),
      );
      setCustomerEmail(keycloak.tokenParsed.email || "");
    }

    const expiresAt = Date.now() + 15 * 60 * 1000;
    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeft(diff);

      if (diff <= 0) {
        clearInterval(timerRef.current);
        sessionStorage.removeItem("bookingItems");
        sessionStorage.removeItem("bookingSelectedSeats");
        const fallbackPath = selectedEvent?.slug
          ? `/events/${selectedEvent.slug}/book`
          : "/search";
        toast.error("Hết thời gian giữ vé. Bạn sẽ được chuyển lại trang chọn vé.");
        navigate(fallbackPath, { replace: true });
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);
    return () => clearInterval(timerRef.current);
  }, [navigate, keycloak]);

  useEffect(() => {
    setEventImageIndex(0);
  }, [event?.id]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isLowTime = timeLeft <= 120;
  const eventImageCandidates = [
    event?.bannerUrl,
    event?.thumbnailUrl,
    event?.images?.find((img) => img.type === "BANNER")?.url,
    event?.images?.[0]?.url,
  ].filter((url): url is string => Boolean(url && url.trim()));
  const eventImageSrc =
    eventImageCandidates[eventImageIndex] ||
    "https://via.placeholder.com/96x96?text=Event";
  const startStr =
    event?.schedule?.startDatetime ||
    event?.startDatetime ||
    (event as any)?.startTime;
  const startDate = startStr ? new Date(startStr) : null;

  const subtotal = bookingItems.reduce((sum, item) => {
    const ticketType = ticketTypes.find((t) => t.id === item.ticketTypeId);
    return sum + (ticketType?.price || 0) * item.quantity;
  }, 0);

  const selectedSeatLabelsByType = useMemo(() => {
    return selectedSeats.reduce<Record<string, string[]>>((acc, seat) => {
      if (!seat.ticketTypeId) return acc;
      const normalizedLabel = normalizeSeatLabel(
        seat.seatLabel?.trim() || seat.seatId,
      );
      if (!acc[seat.ticketTypeId]) {
        acc[seat.ticketTypeId] = [];
      }
      acc[seat.ticketTypeId].push(normalizedLabel);
      return acc;
    }, {});
  }, [selectedSeats]);

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
        "Số điện thoại không hợp lệ (bắt đầu bằng 0 hoặc +84)";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [customerName, customerEmail, customerPhone]);

  const handlePayment = async (e?: MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!validateForm()) {
      toast.warning("Vui lòng kiểm tra lại thông tin người mua.");
      return;
    }
    if (!event || bookingItems.length === 0) return;
    if (timeLeft <= 0) return;

    setIsSubmitting(true);

    try {
      const bookingRequest: CreateBookingRequest = {
        eventId: event.id,
        items: bookingItems,
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        customerPhone: customerPhone.replace(/\s/g, ""),
        promotionCode: voucherCode.trim() || undefined,
      };

      const booking = await bookingService.createBooking(bookingRequest);
      const payment = await paymentService.initiatePayment(booking.orderId);
      const paymentUrl = payment.paymentUrl?.trim() || "";

      sessionStorage.removeItem("bookingItems");
      sessionStorage.removeItem("bookingEvent");
      sessionStorage.removeItem("bookingTicketTypes");
      sessionStorage.removeItem("bookingSelectedSeats");
      sessionStorage.setItem("lastOrderId", booking.orderId);
      sessionStorage.setItem("lastOrderNumber", booking.orderNumber);

      if (paymentUrl) {
        if (/^https?:\/\//i.test(paymentUrl)) {
          window.location.assign(paymentUrl);
        } else {
          navigate(paymentUrl.startsWith("/") ? paymentUrl : `/${paymentUrl}`);
        }
        return;
      }

      navigate("/payment-result", {
        replace: true,
        state: { fromCheckout: true },
      });
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 503) {
        toast.error("Cổng thanh toán đang bận. Vui lòng thử lại sau vài giây.");
      } else if (status === 405) {
        toast.error("Endpoint thanh toán chưa sẵn sàng. Vui lòng thử lại sau.");
      } else {
        toast.error(
          err?.response?.data?.message ||
            err?.response?.data?.error?.message ||
            "Có lỗi xảy ra khi thanh toán. Vui lòng thử lại.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReselectTickets = () => {
    if (event?.slug) {
      navigate(`/events/${event.slug}/book`);
      return;
    }
    navigate(-1);
  };

  if (!event || bookingItems.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <p>Đang tải</p>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <div className="loading-spinner" style={{ margin: "0 auto 16px" }} />
        <p>Đang xác thực đăng nhập</p>
      </div>
    );
  }

  if (!keycloak?.authenticated) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <p style={{ marginBottom: 8 }}>Bạn cần đăng nhập để tiếp tục thanh toán.</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            keycloak.login({ redirectUri: `${window.location.origin}/checkout` })
          }
        >
          Đăng nhập
        </button>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <div className="booking-focus-header">
        <div className="container">
          <div className="focus-event-info">
            <img
              src={eventImageSrc}
              alt={event.title}
              className="event-thumb"
              onError={() =>
                setEventImageIndex((prev) =>
                  prev < eventImageCandidates.length ? prev + 1 : prev,
                )
              }
            />
            <div>
              <div className="event-name">{event.title}</div>
              {startDate && (
                <div className="event-date">
                  {startDate.toLocaleDateString("vi-VN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
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
            <div className="step-divider" />
            <div className="step-item active">
              <span className="step-number">2</span>
              <span>Thanh toán</span>
            </div>
            <div className="step-divider" />
            <div className="step-item">
              <span className="step-number">3</span>
              <span>Kết quả</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="checkout-layout">
          <div className="checkout-main">
            <div className="checkout-form-section">
              <h2 className="buyer-info-title">
                <User size={20} />
                <span>Thông tin người mua</span>
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
          </div>

          <aside className="checkout-sidebar">
            <div className={`checkout-timer-card ${isLowTime ? "warning" : ""}`}>
              <div className="timer-heading">
                <span>Hoàn tất đặt vé trong</span>
              </div>
              <div className="timer-badges">
                <span className="timer-badge">{formatTimer(minutes)}</span>
                <span className="timer-colon">:</span>
                <span className="timer-badge">{formatTimer(seconds)}</span>
              </div>
            </div>

            <div className="sidebar-card">
              <div className="sidebar-card-header">
                <h3>Thông tin đặt vé</h3>
                <button
                  type="button"
                  className="reselect-link"
                  onClick={handleReselectTickets}
                >
                  Chọn lại vé
                </button>
              </div>

              <div className="ticket-summary-list">
                {bookingItems.map((item, idx) => {
                  const ticketType = ticketTypes.find(
                    (t) => t.id === item.ticketTypeId,
                  );
                  const unitPrice = ticketType?.price || 0;
                  const lineTotal = unitPrice * item.quantity;
                  const rawSeatLabels =
                    getSeatLabelsFromSeatIds(item.seatIds).length > 0
                      ? getSeatLabelsFromSeatIds(item.seatIds)
                      : getSeatLabelsFromLabels(
                          selectedSeatLabelsByType[item.ticketTypeId],
                        );
                  const seatLabels = Array.from(new Set(rawSeatLabels));
                  const zoneTag = ticketType?.sectorId
                    ? `Zone ${ticketType.sectorId.slice(0, 6)}`
                    : null;

                  return (
                    <div className="ticket-summary-item" key={`${item.ticketTypeId}-${idx}`}>
                      <div className="ticket-item-left">
                        <p className="ticket-name">{ticketType?.name || "Vé sự kiện"}</p>
                        <p className="ticket-description">
                          {ticketType?.description || "Vé điện tử tham dự sự kiện"}
                        </p>
                        {zoneTag && (
                          <div className="ticket-tags">
                            <span className="ticket-tag">{zoneTag}</span>
                          </div>
                        )}
                      </div>

                      <div className="ticket-item-right">
                        <span className="ticket-qty">x{item.quantity}</span>
                      </div>

                      <div className="ticket-meta-row">
                        {seatLabels.length > 0 && (
                          <div className="seat-pill-list">
                            {seatLabels.map((seatLabel) => (
                              <span
                                className="seat-pill"
                                key={`${item.ticketTypeId}-${seatLabel}`}
                              >
                                {seatLabel}
                              </span>
                            ))}
                          </div>
                        )}
                        <span className="ticket-price">{formatCurrency(lineTotal)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="sidebar-card">
              <div className="sidebar-card-header">
                <h3>Thông tin đơn hàng</h3>
              </div>

              <div className="sidebar-voucher">
                <label className="voucher-label">
                  Mã giảm giá
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nhập mã voucher"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                />
              </div>

              <div className="order-pricing">
                <div className="pricing-row">
                  <span>Tạm tính</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="pricing-divider" />
                <div className="pricing-row total">
                  <span>Tổng tiền</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
              </div>

              <p className="checkout-terms">
                Bằng việc tiếp tục, bạn đồng ý với{" "}
                <a href="#" onClick={(e) => e.preventDefault()}>
                  Điều khoản giao dịch
                </a>{" "}
                của FlashTicket.
              </p>

              <button
                type="button"
                className="btn-pay"
                onClick={handlePayment}
                disabled={isSubmitting || timeLeft <= 0}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner" />
                    Đang xử lý
                  </>
                ) : (
                  <> 
                    Thanh toán
                  </>
                )}
              </button>

              {isLowTime && (
                <p className="timer-warning-note">
                  <AlertTriangle size={14} />
                  Sắp hết thời gian giữ vé, vui lòng hoàn tất thanh toán.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
