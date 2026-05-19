import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  type MouseEvent,
} from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";
import { useKeycloak } from "@react-keycloak/web";
import { toast } from "react-toastify";
import {
  bookingService,
  CreateBookingRequest,
  BookingItemRequest,
} from "../../services/bookingService";
import { paymentService } from "../../services/paymentService";
import { EventSummary, TicketType } from "../../types/api";
import BookingStepIndicator from "../../components/common/BookingStepIndicator";
import {
  User,
  AlertTriangle,
  ChevronRight,
  Home,
  ShieldCheck,
} from "lucide-react";
import { IoIosInformationCircle } from "react-icons/io";
import { TiTicket } from "react-icons/ti";

function formatCurrency(value: number): string {
  return `${value.toLocaleString("vi-VN")} đ`;
}

function formatTimer(value: number): string {
  return value.toString().padStart(2, "0");
}

function normalizeSeatLabel(value: string): string {
  return value.trim();
}

function truncateBreadcrumbLabel(value: string, maxLength = 70): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function getSeatLabelsFromSeatIds(_seatIds?: string[]): string[] {
  return [];
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
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const allowNavigationRef = useRef(false);
  const popStateReadyRef = useRef(false);

  const shouldBlockNavigation =
    Boolean(event) && bookingItems.length > 0 && !allowNavigationRef.current;

  useEffect(() => {
    if (!shouldBlockNavigation) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [shouldBlockNavigation]);

  useEffect(() => {
    if (!shouldBlockNavigation) return;

    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.pushState({ checkoutGuard: true }, "", currentPath);
    popStateReadyRef.current = true;

    const handlePopState = () => {
      if (!popStateReadyRef.current || allowNavigationRef.current) return;
      const nowPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.history.pushState({ checkoutGuard: true }, "", nowPath);
      setShowLeaveModal(true);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      popStateReadyRef.current = false;
      window.removeEventListener("popstate", handlePopState);
    };
  }, [shouldBlockNavigation]);

  useEffect(() => {
    if (!shouldBlockNavigation) return;

    const handleDocumentClick = (event: globalThis.MouseEvent) => {
      if (allowNavigationRef.current) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.origin);
      if (nextUrl.origin !== window.location.origin) return;

      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (nextPath === currentPath) return;

      event.preventDefault();
      setShowLeaveModal(true);
    };

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [shouldBlockNavigation]);

  useEffect(() => {
    const itemsData = sessionStorage.getItem("bookingItems");
    const eventData = sessionStorage.getItem("bookingEvent");
    const typesData = sessionStorage.getItem("bookingTicketTypes");
    const selectedSeatsData = sessionStorage.getItem("bookingSelectedSeats");

    if (!itemsData || !eventData) {
      allowNavigationRef.current = true;
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
        allowNavigationRef.current = true;
        navigate(fallbackPath, { replace: true });
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);
    return () => clearInterval(timerRef.current);
  }, [navigate, keycloak]);

  useEffect(() => {
    if (!initialized || !keycloak?.authenticated || !keycloak?.tokenParsed) {
      return;
    }

    const parsed = keycloak.tokenParsed as Record<string, any>;
    const fullName =
      parsed.name ||
      `${parsed.given_name || ""} ${parsed.family_name || ""}`.trim();
    const email = parsed.email || "";
    const phone = parsed.phone_number || parsed.phone || "";

    if (fullName) {
      setCustomerName((prev) => prev.trim() || fullName);
    }
    if (email) {
      setCustomerEmail((prev) => prev.trim() || email);
    }
    if (phone) {
      setCustomerPhone((prev) => prev.trim() || phone);
    }
  }, [initialized, keycloak?.authenticated, keycloak?.token]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isLowTime = timeLeft <= 120;

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

  const breadcrumbEventName = truncateBreadcrumbLabel(event?.title || "", 20);
  const selectTicketPath = event?.slug ? `/events/${event.slug}/book` : "/search";

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
      allowNavigationRef.current = true;

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

  const handleStayOnCheckout = () => {
    setShowLeaveModal(false);
  };

  const handleConfirmLeaveCheckout = () => {
    setShowLeaveModal(false);
    allowNavigationRef.current = true;
    sessionStorage.removeItem("bookingItems");
    sessionStorage.removeItem("bookingSelectedSeats");

    if (event?.slug) {
      navigate(`/events/${event.slug}/book`);
      return;
    }

    navigate("/search");
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
          onClick={() => {
            allowNavigationRef.current = true;
            keycloak.login({ redirectUri: `${window.location.origin}/checkout` });
          }}
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
          <nav className="focus-breadcrumb" aria-label="Breadcrumb">
            <ol className="breadcrumb-list">
              <li className="breadcrumb-item">
                <Link to="/" className="breadcrumb-home">
                  <Home size={15} />
                  Home
                </Link>
              </li>
              <li className="breadcrumb-separator" aria-hidden="true">
                <ChevronRight size={14} />
              </li>
              <li className="breadcrumb-item">
                <Link to="/search" className="breadcrumb-event">
                  Events
                </Link>
              </li>
              <li className="breadcrumb-separator" aria-hidden="true">
                <ChevronRight size={14} />
              </li>
              <li className="breadcrumb-item">
                <Link
                  to={selectTicketPath}
                  className="breadcrumb-event-name"
                  title={event.title}
                  aria-label={event.title}
                >
                  {breadcrumbEventName}
                </Link>
              </li>
              <li className="breadcrumb-separator" aria-hidden="true">
                <ChevronRight size={14} />
              </li>
              <li className="breadcrumb-item">
                <span className="breadcrumb-current" aria-current="page">
                  Checkout
                </span>
              </li>
            </ol>
          </nav>

          <BookingStepIndicator currentStep={2} />
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

            <div className="checkout-info-card">
              <div className="checkout-info-header">
                <ShieldCheck size={18} />
                <h3>Lưu ý trước khi thanh toán</h3>
              </div>

              <ul className="checkout-info-list">
                <li className="checkout-info-item">
                  <strong>Giữ vé trong 15 phút</strong>
                  <p>
                    Vé đang được giữ tạm thời cho bạn. Nếu hết thời gian, hệ thống sẽ trả lại ghế.
                  </p>
                </li>

                <li className="checkout-info-item">
                  <strong>Nhận vé qua email</strong>
                  <p>
                    Hãy nhập email chính xác để nhận xác nhận đơn hàng và vé điện tử sau khi thanh toán.
                  </p>
                </li>

                <li className="checkout-info-item">
                  <strong>Kiểm tra thông tin thật kỹ</strong>
                  <p>
                    Tên, email và số điện thoại sẽ được dùng cho xác nhận thanh toán và hỗ trợ sau này.
                  </p>
                </li>
              </ul>
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
                <h3>
                  <TiTicket size={22} /> Thông tin đặt vé
                </h3>
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
                  const labelsFromSelection = getSeatLabelsFromLabels(
                    selectedSeatLabelsByType[item.ticketTypeId],
                  );
                  const rawSeatLabels =
                    labelsFromSelection.length > 0
                      ? labelsFromSelection
                      : getSeatLabelsFromSeatIds(item.seatIds);
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
                <h3>
                  <IoIosInformationCircle size={22} /> Thông tin đơn hàng
                </h3>
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

      {showLeaveModal && (
        <div className="checkout-leave-modal-overlay" role="dialog" aria-modal="true">
          <div className="checkout-leave-modal">
            <div className="checkout-leave-modal-header">
              <h3>Hủy đơn hàng ?</h3>
            </div>

            <p className="checkout-leave-modal-subtitle">
              Bạn có chắc chắn muốn tiếp tục ?
            </p>

            <ul className="checkout-leave-modal-list">
              <li>Bạn sẽ mất vị trí mình đã lựa chọn.</li>
              <li>
                Đơn hàng đang trong quá trình thanh toán hoặc đã thanh toán thành công cũng có thể bị hủy.
              </li>
            </ul>

            <div className="checkout-leave-modal-actions">
              <button
                type="button"
                className="checkout-leave-btn checkout-leave-btn-danger"
                onClick={handleConfirmLeaveCheckout}
              >
                Hủy đơn
              </button>
              <button
                type="button"
                className="checkout-leave-btn checkout-leave-btn-safe"
                onClick={handleStayOnCheckout}
              >
                Ở lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
