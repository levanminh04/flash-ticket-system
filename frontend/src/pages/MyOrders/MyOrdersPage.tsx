import { useEffect, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ShoppingBag, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import AccountSidebar from "../../components/account/AccountSidebar";
import AppPagination from "../../components/common/AppPagination";
import AccountCategoryNav from "../../components/common/AccountCategoryNav";
import { confirmDestructiveAction } from "../../lib/swal";
import { orderService, OrderDetail, OrderSummary } from "../../services/orderService";

type OrderStatusFilter = "ALL" | "PENDING" | "CONFIRMED" | "CANCELLED" | "REFUNDED" | "EXPIRED";
const PAGE_SIZE = 5;

function formatDate(iso: string | null | undefined, language: string): string {
  if (iso == null || iso === "") return "-";
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return String(iso);
    return date.toLocaleString(language === "en" ? "en-US" : "vi-VN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

function formatCurrency(value: number | null | undefined, language: string): string {
  return `${Number(value ?? 0).toLocaleString(language === "en" ? "en-US" : "vi-VN")} đ`;
}

function statusLabel(status: string, t: (key: string) => string) {
  switch (status) {
    case "PENDING":
      return { text: t("status.pending"), cls: "status-pending" };
    case "CONFIRMED":
      return { text: t("status.confirmed"), cls: "status-confirmed" };
    case "CANCELLED":
      return { text: t("status.cancelled"), cls: "status-cancelled" };
    case "EXPIRED":
      return { text: t("status.expired"), cls: "status-expired" };
    case "REFUNDED":
      return { text: t("status.refunded"), cls: "status-refunded" };
    default:
      return { text: status, cls: "" };
  }
}

export default function MyOrdersPage() {
  const { i18n, t } = useTranslation();
  const { keycloak, initialized } = useKeycloak();
  const navigate = useNavigate();
  const [content, setContent] = useState<OrderSummary[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("ALL");
  const language = i18n.resolvedLanguage || "vi";

  useEffect(() => {
    if (!initialized) return;
    if (!keycloak.authenticated) {
      void keycloak.login({
        redirectUri: `${window.location.origin}/my-orders`,
      });
    }
  }, [initialized, keycloak, keycloak.authenticated]);

  useEffect(() => {
    if (!keycloak.authenticated) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await orderService.getMyOrders(page, PAGE_SIZE);
        if (!cancelled) {
          setContent(res.content);
          setTotalPages(res.totalPages);
        }
      } catch {
        if (!cancelled) {
          setError(t("ordersPage.loadFailed"));
          toast.error(t("ordersPage.loadFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [keycloak.authenticated, page, t]);

  const openDetail = async (orderId: string) => {
    try {
      const detail = await orderService.getOrderDetail(orderId);
      setSelectedOrder(detail ?? null);
    } catch {
      setSelectedOrder(null);
      toast.error(t("ordersPage.loadDetailFailed"));
    }
  };

  const handleCancel = async (orderId: string) => {
    const confirmed = await confirmDestructiveAction({
      title: t("ordersPage.cancelTitle"),
      text: t("ordersPage.cancelText"),
      confirmButtonText: t("ordersPage.cancelConfirm"),
      cancelButtonText: t("ordersPage.cancelKeep"),
    });
    if (!confirmed) return;

    setCancelling(orderId);
    try {
      await orderService.cancelOrder(orderId);
      setSelectedOrder(null);
      toast.success(t("ordersPage.cancelSuccess"));
      const res = await orderService.getMyOrders(page, PAGE_SIZE);
      setContent(res.content);
      setTotalPages(res.totalPages);
    } catch {
      toast.error(t("ordersPage.cancelFailed"));
    } finally {
      setCancelling(null);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleContinuePayment = (orderId: string, orderNumber?: string | null) => {
    sessionStorage.setItem("lastOrderId", orderId);
    if (orderNumber) {
      sessionStorage.setItem("lastOrderNumber", orderNumber);
    }
    navigate(`/checkout?orderId=${orderId}`);
  };

  const filteredOrders = content.filter((order) => {
    if (statusFilter !== "ALL" && order.status !== statusFilter) return false;
    return true;
  });
  const orderStatusTabs: Array<{ value: OrderStatusFilter; label: string }> = [
    { value: "ALL", label: t("status.all") },
    { value: "PENDING", label: t("status.pending") },
    { value: "CONFIRMED", label: t("status.confirmed") },
    { value: "CANCELLED", label: t("status.cancelled") },
  ];

  if (!initialized || !keycloak.authenticated) return null;

  return (
    <div className="my-orders-page">
      <AccountCategoryNav />
      <div className="container account-layout-container">
        <AccountSidebar />

        <div className="account-main-content">
          <h1 className="page-title">{t("ordersPage.title")}</h1>
          {loading ? (
            <div className="list-loading">
              <div className="loading-spinner"></div>
              <span>{t("ticketsPage.loading")}</span>
            </div>
          ) : error ? (
            <div className="list-error">{error}</div>
          ) : content.length === 0 ? (
            <div className="list-empty">
              <ShoppingBag size={48} />
              <p>{t("ordersPage.empty")}</p>
              <Link to="/search" className="btn btn-primary">
                {t("ticketsPage.exploreEvents")}
              </Link>
            </div>
          ) : (
            <>
              <div className="my-ticket-status-tabs" aria-label={t("ordersPage.filterLabel")}>
                {orderStatusTabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    className={`my-ticket-status-tab${statusFilter === tab.value ? " active" : ""}`}
                    onClick={() => setStatusFilter(tab.value)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {filteredOrders.length === 0 ? (
                <div className="list-empty ticket-filter-empty">
                  <ShoppingBag size={36} />
                  <p>{t("ordersPage.filterEmpty")}</p>
                </div>
              ) : (
                <div className="order-list">
                  {filteredOrders.map((order) => {
                    const sl = statusLabel(order.status, t);
                    return (
                      <div key={order.id} className="order-card">
                        <div className="order-card-main">
                          <h3 className="order-event-title">{order.eventTitle}</h3>
                          <p className="order-meta">
                            {t("ordersPage.orderDate")}: {formatDate(order.createdAt, language)} • {t("ordersPage.orderNumber")}: {order.orderNumber}
                          </p>
                          <div className="order-card-footer">
                            <span className={`order-status ${sl.cls}`}>{sl.text}</span>
                          </div>
                        </div>
                        <div className="order-card-actions">
                          <button className="btn btn-outline btn-sm" onClick={() => void openDetail(order.id)}>
                            {t("ordersPage.detail")}
                          </button>
                          <span className="order-amount">{formatCurrency(order.totalAmount, language)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <AppPagination
                currentPage={page}
                pageCount={totalPages}
                onPageChange={handlePageChange}
                pageRangeDisplayed={4}
                marginPagesDisplayed={1}
                showPageInfo={false}
              />
            </>
          )}
        </div>
      </div>

      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content order-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedOrder(null)}><X size={24} /></button>
            <h2>{selectedOrder.eventTitle}</h2>
            <p className="modal-meta">
              <span style={{ opacity: 0.8 }}>{t("ordersPage.eventTime")} </span>
              {formatDate(selectedOrder.eventStartDatetime, language)}
              {selectedOrder.eventVenueName && ` • ${selectedOrder.eventVenueName}`}
            </p>
            <div className="order-detail-info">
              <div className="info-row"><span className="label">{t("ordersPage.orderNumber")}</span><span className="value">{selectedOrder.orderNumber}</span></div>
              <div className="info-row"><span className="label">{t("ordersPage.placedAt")}</span><span className="value">{formatDate(selectedOrder.createdAt, language)}</span></div>
              {selectedOrder.paidAt ? (
                <div className="info-row"><span className="label">{t("ordersPage.paidAt")}</span><span className="value">{formatDate(selectedOrder.paidAt, language)}</span></div>
              ) : null}
              <div className="info-row"><span className="label">{t("ticketsPage.status")}</span><span className={`value order-detail-status ${statusLabel(selectedOrder.status, t).cls}`}>{statusLabel(selectedOrder.status, t).text}</span></div>
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div className="order-items">
                  <p className="items-label">{t("ordersPage.orderItems")}</p>
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="order-item-row">
                      <span className="order-item-name">{item.ticketTypeName}</span>
                      <span className="order-item-qty">x{item.quantity}</span>
                      <span className="order-item-subtotal">{formatCurrency(item.subtotal, language)}</span>
                    </div>
                  ))}
                </div>
              )}
              {Number(selectedOrder.discountAmount ?? 0) > 0 ? (
                <div className="info-row discount">
                  <span className="label">
                    {t("ordersPage.discount")}{selectedOrder.promotionCode ? ` (${selectedOrder.promotionCode})` : ""}
                  </span>
                  <span className="value">-{formatCurrency(selectedOrder.discountAmount, language)}</span>
                </div>
              ) : null}
              <div className="info-row total"><span className="label">{t("ordersPage.total")}</span><span className="value">{formatCurrency(selectedOrder.totalAmount, language)}</span></div>
            </div>
            {selectedOrder.status === "PENDING" && (
              <div style={{ display: "flex", gap: 12, width: "100%" }}>
                <button className="btn btn-outline btn-danger" style={{ flex: 1 }} onClick={() => void handleCancel(selectedOrder.id)} disabled={cancelling === selectedOrder.id}>
                  {cancelling === selectedOrder.id ? t("ordersPage.cancelling") : t("ordersPage.cancel")}
                </button>
                <button
                  className="btn btn-primary"
                  type="button"
                  style={{ flex: 1 }}
                  onClick={() => handleContinuePayment(selectedOrder.id, selectedOrder.orderNumber)}
                >
                  {t("ordersPage.continue")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
