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
  useSearchParams,
} from "react-router-dom";
import { useKeycloak } from "@react-keycloak/web";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { orderService, OrderDetail } from "../../services/orderService";
import { paymentService } from "../../services/paymentService";
import { eventService } from "../../services/eventService";
import { EventSummary } from "../../types/api";
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
import { FaCheck } from "react-icons/fa6";

function formatCurrency(value: number, language: string): string {
  return `${value.toLocaleString(language === "en" ? "en-US" : "vi-VN")} đ`;
}

function formatTimer(value: number): string {
  return value.toString().padStart(2, "0");
}

function truncateBreadcrumbLabel(value: string, maxLength = 70): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
}

const paymentStrategyLogos = {
  default: "https://cdn.haitrieu.com/wp-content/uploads/2022/10/Icon-VNPAY-QR.png",
  qr: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/MoMo_Logo_App.svg/960px-MoMo_Logo_App.svg.png",
  bank: "https://congtyquatang.com.vn/wp-content/uploads/2026/02/Logo-VietinBank-CTG-Ori.png",
  card: "https://download.logo.wine/logo/Visa_Inc./Visa_Inc.-Logo.wine.png",
};

export default function CheckoutPage() {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { keycloak, initialized } = useKeycloak();
  const language = i18n.resolvedLanguage || "vi";

  const orderId = searchParams.get("orderId") || sessionStorage.getItem("lastOrderId") || "";

  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);
  const [event, setEvent] = useState<EventSummary | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [timeLeft, setTimeLeft] = useState<number>(15 * 60);
  const [selectedBankCode, setSelectedBankCode] = useState<string>(""); // bankCode: "", "VNPAYQR", "VNBANK", "INTCARD"
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const allowNavigationRef = useRef(false);
  const popStateReadyRef = useRef(false);

  const ticketTypeColorById = useMemo(() => {
    const mapping = new Map<string, string>();
    (event?.ticketTypes ?? []).forEach((ticketType) => {
      if (ticketType.id && ticketType.colorCode) {
        mapping.set(ticketType.id, ticketType.colorCode);
      }
    });
    return mapping;
  }, [event?.ticketTypes]);

  const clearCheckoutSession = useCallback(() => {
    sessionStorage.removeItem("bookingItems");
    sessionStorage.removeItem("bookingEvent");
    sessionStorage.removeItem("bookingTicketTypes");
    sessionStorage.removeItem("bookingSelectedSeats");
    sessionStorage.removeItem("bookingHold");
    sessionStorage.removeItem("lastOrderId");
    sessionStorage.removeItem("lastOrderNumber");
  }, []);

  // Fetch Order and Event details
  useEffect(() => {
    if (!initialized) return;

    if (!orderId) {
      toast.error(t("checkout.missingOrder"));
      allowNavigationRef.current = true;
      navigate("/");
      return;
    }

    const fetchOrderAndEvent = async () => {
      setIsLoadingOrder(true);
      try {
        const order = await orderService.getOrderDetail(orderId);
        if (!order) {
          toast.error(t("checkout.orderNotFound"));
          allowNavigationRef.current = true;
          navigate("/");
          return;
        }

        if (order.status !== "PENDING") {
          toast.info(t("checkout.orderStatus", { status: order.status }));
          allowNavigationRef.current = true;
          if (order.status === "CONFIRMED") {
            navigate("/payment-result", { state: { fromCheckout: true } });
          } else {
            navigate("/");
          }
          return;
        }

        setOrderDetail(order);
        setCustomerName(order.customerName || "");
        setCustomerEmail(order.customerEmail || "");
        setCustomerPhone(order.customerPhone || "");

        // Fetch event slug and basic details
        const eventData = await eventService.getEventDetails(order.eventId);
        setEvent(eventData);
      } catch (err) {
        console.error("Error loading order or event details:", err);
        toast.error(t("ordersPage.loadDetailFailed"));
        allowNavigationRef.current = true;
        navigate("/");
      } finally {
        setIsLoadingOrder(false);
      }
    };

    void fetchOrderAndEvent();
  }, [orderId, initialized, navigate, t]);

  // Page unload guard
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (allowNavigationRef.current || !orderDetail || orderDetail.status !== "PENDING") {
        return;
      }
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [orderDetail]);

  // Popstate navigation guard
  useEffect(() => {
    if (!orderDetail || orderDetail.status !== "PENDING") return;

    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.history.pushState({ checkoutGuard: true }, "", currentPath);
    popStateReadyRef.current = true;

    const handlePopState = () => {
      if (allowNavigationRef.current) return;
      if (!popStateReadyRef.current) return;
      const nowPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.history.pushState({ checkoutGuard: true }, "", nowPath);
      setShowLeaveModal(true);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      popStateReadyRef.current = false;
      window.removeEventListener("popstate", handlePopState);
    };
  }, [orderDetail]);

  // Link click guard
  useEffect(() => {
    if (!orderDetail || orderDetail.status !== "PENDING") return;

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
  }, [orderDetail]);

  // Countdown timer based on expiresAt
  useEffect(() => {
    if (!orderDetail?.expiresAt) {
      return;
    }

    clearInterval(timerRef.current);
    const expiresAt = new Date(orderDetail.expiresAt).getTime();

    const handleTimeout = async () => {
      clearInterval(timerRef.current);
      clearCheckoutSession();
      toast.error(t("checkout.holdTimeout"));
      allowNavigationRef.current = true;
      if (orderId) {
        try {
          await orderService.cancelOrder(orderId);
        } catch (err) {
          console.error("Failed to cancel order on timeout:", err);
        }
      }
      const fallbackPath = event?.slug ? `/events/${event.slug}/book` : "/search";
      navigate(fallbackPath, { replace: true });
    };

    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeft(diff);

      if (diff <= 0) {
        void handleTimeout();
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);
    return () => clearInterval(timerRef.current);
  }, [orderDetail?.expiresAt, event, orderId, navigate, clearCheckoutSession, t]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const isLowTime = timeLeft <= 120;

  const breadcrumbEventName = truncateBreadcrumbLabel(event?.title || orderDetail?.eventTitle || "", 20);
  const selectTicketPath = event?.slug ? `/events/${event.slug}/book` : "/search";

  const handlePayment = async (e?: MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!orderDetail) return;
    if (timeLeft <= 0) return;

    setIsSubmitting(true);

    try {
      const payment = await paymentService.initiatePayment(orderDetail.id, selectedBankCode || undefined);
      const paymentUrl = payment.paymentUrl?.trim() || "";

      clearCheckoutSession();
      sessionStorage.setItem("lastOrderId", orderDetail.id);
      sessionStorage.setItem("lastOrderNumber", orderDetail.orderNumber);
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
        toast.error(t("checkout.paymentBusy"));
      } else if (status === 405) {
        toast.error(t("checkout.paymentEndpointUnavailable"));
      } else {
        toast.error(
          err?.response?.data?.message ||
            err?.response?.data?.error?.message ||
            t("checkout.paymentError"),
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStayOnCheckout = () => {
    setShowLeaveModal(false);
  };

  const handleConfirmLeaveCheckout = async () => {
    setShowLeaveModal(false);
    allowNavigationRef.current = true;
    clearCheckoutSession();

    if (orderId) {
      try {
        await orderService.cancelOrder(orderId);
      } catch (err) {
        console.error("Failed to cancel order:", err);
      }
    }

    if (event?.slug) {
      navigate(`/events/${event.slug}/book`);
      return;
    }
    navigate("/search");
  };

  const handleReselectTickets = async () => {
    allowNavigationRef.current = true;
    clearCheckoutSession();

    if (orderId) {
      try {
        await orderService.cancelOrder(orderId);
      } catch (err) {
        console.error("Failed to cancel order:", err);
      }
    }

    if (event?.slug) {
      navigate(`/events/${event.slug}/book`);
      return;
    }
    navigate(-1);
  };

  if (!initialized || isLoadingOrder) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <div className="loading-spinner" style={{ margin: "0 auto 16px" }} />
        <p>{t("checkout.loadingOrder")}</p>
      </div>
    );
  }

  if (!keycloak?.authenticated) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <p style={{ marginBottom: 8 }}>{t("checkout.loginRequired")}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            allowNavigationRef.current = true;
            keycloak.login({ redirectUri: window.location.href });
          }}
        >
          {t("auth.signIn")}
        </button>
      </div>
    );
  }

  if (!orderDetail) {
    return (
      <div style={{ textAlign: "center", padding: "100px" }}>
        <p>{t("checkout.missingOrder")}</p>
        <Link to="/" className="btn btn-outline" style={{ marginTop: 16 }}>
          {t("checkout.returnHome")}
        </Link>
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
                  {t("nav.home")}
                </Link>
              </li>
              <li className="breadcrumb-separator" aria-hidden="true">
                <ChevronRight size={14} />
              </li>
              <li className="breadcrumb-item">
                <Link to="/search" className="breadcrumb-event">
                  {t("nav.events")}
                </Link>
              </li>
              <li className="breadcrumb-separator" aria-hidden="true">
                <ChevronRight size={14} />
              </li>
              <li className="breadcrumb-item">
                <Link
                  to={selectTicketPath}
                  className="breadcrumb-event-name"
                  title={event?.title || orderDetail.eventTitle}
                  aria-label={event?.title || orderDetail.eventTitle}
                >
                  {breadcrumbEventName}
                </Link>
              </li>
              <li className="breadcrumb-separator" aria-hidden="true">
                <ChevronRight size={14} />
              </li>
              <li className="breadcrumb-item">
                <span className="breadcrumb-current" aria-current="page">
                  {t("checkout.checkout")}
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
                <span>{t("checkout.buyerInfo")}</span>
              </h2>

              <div className="form-group">
                <label><span className="checkout-required-star">*</span>{t("profile.displayName")}</label>
                <input
                  type="text"
                  className="form-input"
                  value={customerName}
                  readOnly
                  disabled
                  style={{ background: "#f1f5f9", cursor: "not-allowed" }}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label><span className="checkout-required-star">*</span>{t("profile.email")}</label>
                  <input
                    type="email"
                    className="form-input"
                    value={customerEmail}
                    readOnly
                    disabled
                    style={{ background: "#f1f5f9", cursor: "not-allowed" }}
                  />
                </div>

                <div className="form-group">
                  <label><span className="checkout-required-star">*</span>{t("profile.phone")}</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={customerPhone}
                    readOnly
                    disabled
                    style={{ background: "#f1f5f9", cursor: "not-allowed" }}
                  />
                </div>
              </div>

              {orderDetail.customerNote && (
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label>{t("selectTicket.note")}</label>
                  <textarea
                    className="form-input"
                    value={orderDetail.customerNote}
                    readOnly
                    disabled
                    style={{ background: "#f1f5f9", cursor: "not-allowed", minHeight: "60px", resize: "none" }}
                  />
                </div>
              )}
            </div>

            <div className="checkout-form-section" style={{ marginTop: "24px" }}>
              <h2 className="buyer-info-title">
                <ShieldCheck size={20} />
                <span>{t("checkout.paymentMethod")}</span>
              </h2>
              
              <div className="payment-strategies-list" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <label className={`payment-strategy-item ${selectedBankCode === "" ? "active" : ""}`} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}>
                  <input
                    type="radio"
                    name="payment_strategy"
                    value=""
                    checked={selectedBankCode === ""}
                    onChange={() => setSelectedBankCode("")}
                    className="payment-strategy-radio-input"
                  />
                  <span className="payment-strategy-radio" aria-hidden="true">
                    <FaCheck size={10} />
                  </span>
                  <img
                    src={paymentStrategyLogos.default}
                    alt=""
                    className="payment-strategy-logo"
                    aria-hidden="true"
                  />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: 600, fontSize: "14px" }}>{t("checkout.defaultPaymentTitle")}</span>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{t("checkout.defaultPaymentDescription")}</span>
                  </div>
                </label>

                <label className={`payment-strategy-item ${selectedBankCode === "VNPAYQR" ? "active" : ""}`} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}>
                  <input
                    type="radio"
                    name="payment_strategy"
                    value="VNPAYQR"
                    checked={selectedBankCode === "VNPAYQR"}
                    onChange={() => setSelectedBankCode("VNPAYQR")}
                    className="payment-strategy-radio-input"
                  />
                  <span className="payment-strategy-radio" aria-hidden="true">
                    <FaCheck size={10} />
                  </span>
                  <img
                    src={paymentStrategyLogos.qr}
                    alt=""
                    className="payment-strategy-logo"
                    aria-hidden="true"
                  />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: 600, fontSize: "14px" }}>{t("checkout.qrTitle")}</span>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{t("checkout.qrDescription")}</span>
                  </div>
                </label>

                <label className={`payment-strategy-item ${selectedBankCode === "VNBANK" ? "active" : ""}`} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}>
                  <input
                    type="radio"
                    name="payment_strategy"
                    value="VNBANK"
                    checked={selectedBankCode === "VNBANK"}
                    onChange={() => setSelectedBankCode("VNBANK")}
                    className="payment-strategy-radio-input"
                  />
                  <span className="payment-strategy-radio" aria-hidden="true">
                    <FaCheck size={10} />
                  </span>
                  <img
                    src={paymentStrategyLogos.bank}
                    alt=""
                    className="payment-strategy-logo"
                    aria-hidden="true"
                  />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: 600, fontSize: "14px" }}>{t("checkout.atmTitle")}</span>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{t("checkout.atmDescription")}</span>
                  </div>
                </label>

                <label className={`payment-strategy-item ${selectedBankCode === "INTCARD" ? "active" : ""}`} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}>
                  <input
                    type="radio"
                    name="payment_strategy"
                    value="INTCARD"
                    checked={selectedBankCode === "INTCARD"}
                    onChange={() => setSelectedBankCode("INTCARD")}
                    className="payment-strategy-radio-input"
                  />
                  <span className="payment-strategy-radio" aria-hidden="true">
                    <FaCheck size={10} />
                  </span>
                  <img
                    src={paymentStrategyLogos.card}
                    alt=""
                    className="payment-strategy-logo"
                    aria-hidden="true"
                  />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: 600, fontSize: "14px" }}>{t("checkout.internationalCardTitle")}</span>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{t("checkout.internationalCardDescription")}</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <aside className="checkout-sidebar">
            <div className={`checkout-timer-card ${isLowTime ? "warning" : ""}`}>
              <div className="timer-heading">
                <span>{t("checkout.timerHeading")}</span>
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
                  <TiTicket size={22} /> {t("checkout.ticketInfo")}
                </h3>
                <button
                  type="button"
                  className="reselect-link"
                  onClick={handleReselectTickets}
                >
                  {t("checkout.reselectTickets")}
                </button>
              </div>

              <div className="ticket-summary-list">
                {orderDetail.items?.map((item, idx) => {
                  const lineTotal = item.subtotal;
                  const seatLabels = item.seats ? (item.seats.map(s => s.seatLabel).filter(Boolean) as string[]) : [];
                  const zoneTag = item.sectorName ? `${t("checkout.zone")} ${item.sectorName}` : null;
                  const ticketColor = ticketTypeColorById.get(item.ticketTypeId) || "#2DC275";
                  const ticketColorStyle = {
                    backgroundColor: ticketColor,
                    borderColor: ticketColor,
                    color: "#ffffff",
                  };

                  return (
                    <div className="ticket-summary-item" key={`${item.ticketTypeId}-${idx}`}>
                      <div className="ticket-item-left">
                        <p className="ticket-name">{item.ticketTypeName || t("checkout.eventTicket")}</p>
                        <p className="ticket-description">
                          {t("checkout.eventTicketDescription")}
                        </p>
                        {zoneTag && (
                          <div className="ticket-tags">
                            <span className="ticket-tag" style={ticketColorStyle}>{zoneTag}</span>
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
                                style={ticketColorStyle}
                              >
                                {seatLabel}
                              </span>
                            ))}
                          </div>
                        )}
                        <span className="ticket-price">{formatCurrency(lineTotal, language)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="sidebar-card">
              <div className="sidebar-card-header">
                <h3>
                  <IoIosInformationCircle size={22} /> {t("checkout.orderInfo")}
                </h3>
              </div>

              {orderDetail.promotionCode && (
                <div className="sidebar-voucher">
                  <div className="ticket-tag" style={{ width: "100%", justifyContent: "center", padding: "8px", fontWeight: "600" }}>
                    {t("checkout.appliedCode")} {orderDetail.promotionCode}
                  </div>
                </div>
              )}

              <div className="order-pricing">
                <div className="pricing-row">
                  <span>{t("checkout.subtotal")}</span>
                  <span>{formatCurrency(orderDetail.subtotal || 0, language)}</span>
                </div>
                {orderDetail.discountAmount !== undefined && orderDetail.discountAmount > 0 && (
                  <div className="pricing-row" style={{ color: "var(--error)", marginTop: "8px" }}>
                    <span>{t("checkout.discount")}</span>
                    <span>-{formatCurrency(orderDetail.discountAmount, language)}</span>
                  </div>
                )}
                <div className="pricing-divider" />
                <div className="pricing-row total">
                  <span>{t("checkout.total")}</span>
                  <span>{formatCurrency(orderDetail.totalAmount || 0, language)}</span>
                </div>
              </div>

              <p className="checkout-terms">
                {t("checkout.termsBefore")}{" "}
                <a href="#" onClick={(e) => e.preventDefault()}>
                  {t("checkout.termsLink")}
                </a>{" "}
                {t("checkout.termsAfter")}
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
                    {t("checkout.processing")}
                  </>
                ) : (
                  <>
                    {t("checkout.checkout")}
                  </>
                )}
              </button>

              {isLowTime && (
                <p className="timer-warning-note">
                  <AlertTriangle size={14} />
                  {t("checkout.timerWarning")}
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
              <h3>{t("ordersPage.cancelTitle")}</h3>
            </div>

            <p className="checkout-leave-modal-subtitle">
              {t("checkout.leaveConfirmQuestion")}
            </p>

            <ul className="checkout-leave-modal-list">
              <li>{t("checkout.leaveLoseSelection")}</li>
              <li>
                {t("checkout.leaveOrderCancelled")}
              </li>
            </ul>

            <div className="checkout-leave-modal-actions">
              <button
                type="button"
                className="checkout-leave-btn checkout-leave-btn-danger"
                onClick={handleConfirmLeaveCheckout}
              >
                {t("checkout.cancelOrder")}
              </button>
              <button
                type="button"
                className="checkout-leave-btn checkout-leave-btn-safe"
                onClick={handleStayOnCheckout}
              >
                {t("checkout.stay")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
