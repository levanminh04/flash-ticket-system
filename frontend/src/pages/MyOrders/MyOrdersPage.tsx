import { useEffect, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import AccountSidebar from "../../components/account/AccountSidebar";
import AppPagination from "../../components/common/AppPagination";
import { confirmDestructiveAction } from "../../lib/swal";
import {
  orderService,
  OrderSummary,
  OrderDetail,
} from "../../services/orderService";
import { ShoppingBag, X } from "lucide-react";
import AccountCategoryNav from "../../components/common/AccountCategoryNav";

function formatDate(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "-";
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return String(iso);
    return date.toLocaleString("vi-VN", {
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

function statusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return { text: "Chờ thanh toán", cls: "status-pending" };
    case "CONFIRMED":
      return { text: "Đã xác nhận", cls: "status-confirmed" };
    case "CANCELLED":
      return { text: "Đã hủy", cls: "status-cancelled" };
    case "EXPIRED":
      return { text: "Hết hạn", cls: "status-expired" };
    case "REFUNDED":
      return { text: "Đã hoàn tiền", cls: "status-refunded" };
    default:
      return { text: status, cls: "" };
  }
}

export default function MyOrdersPage() {
  const { keycloak, initialized } = useKeycloak();
  const navigate = useNavigate();
  const [content, setContent] = useState<OrderSummary[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    if (!initialized) return;
    if (!keycloak.authenticated) {
      navigate("/", { replace: true });
    }
  }, [initialized, keycloak.authenticated, navigate]);

  useEffect(() => {
    if (!keycloak.authenticated) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await orderService.getMyOrders(page, 10);
        if (!cancelled) {
          setContent(res.content);
          setTotalPages(res.totalPages);
        }
      } catch (e) {
        if (!cancelled) {
          setError("Không thể tải danh sách đơn hàng.");
          toast.error("Không thể tải danh sách đơn hàng.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [keycloak.authenticated, page]);

  const openDetail = async (orderId: string) => {
    try {
      const detail = await orderService.getOrderDetail(orderId);
      setSelectedOrder(detail ?? null);
    } catch {
      setSelectedOrder(null);
      toast.error("Không thể tải chi tiết đơn hàng.");
    }
  };

  const handleCancel = async (orderId: string) => {
    const confirmed = await confirmDestructiveAction({
      title: "Hủy đơn hàng?",
      text: "Thao tác này sẽ hủy đơn hàng đang chờ thanh toán và không thể hoàn tác.",
      confirmButtonText: "Hủy đơn hàng",
      cancelButtonText: "Giữ đơn hàng",
    });
    if (!confirmed) return;

    setCancelling(orderId);
    try {
      await orderService.cancelOrder(orderId);
      setSelectedOrder(null);
      toast.success("Đã hủy đơn hàng thành công.");
      const res = await orderService.getMyOrders(page, 10);
      setContent(res.content);
      setTotalPages(res.totalPages);
    } catch {
      toast.error("Không thể hủy đơn hàng.");
    } finally {
      setCancelling(null);
    }
  };

  if (!initialized || !keycloak.authenticated) return null;

  return (
    <div className="my-orders-page">
      <AccountCategoryNav />
      <div className="container account-layout-container">
        <AccountSidebar />

        <div className="account-main-content">
          <h1 className="page-title">Đơn hàng của tôi</h1>
          {loading ? (
            <div className="list-loading">
              <div className="loading-spinner"></div>
              <span>Đang tải</span>
            </div>
          ) : error ? (
            <div className="list-error">{error}</div>
          ) : content.length === 0 ? (
            <div className="list-empty">
              <ShoppingBag size={48} />
              <p>Bạn chưa có đơn hàng nào.</p>
              <Link to="/search" className="btn btn-primary">
                Khám phá sự kiện
              </Link>
            </div>
          ) : (
            <>
              <div className="order-list">
                {content.map((o) => {
                  const sl = statusLabel(o.status);
                  return (
                    <div key={o.id} className="order-card">
                      <div className="order-card-main">
                        <h3 className="order-event-title">{o.eventTitle}</h3>
                        <p className="order-meta">
                          {formatDate(o.eventStartDatetime)} • {" "}
                          {o.orderNumber}
                        </p>
                        <div className="order-card-footer">
                          <span className={`order-status ${sl.cls}`}>
                            {sl.text}
                          </span>
                        </div>
                      </div>
                      <div className="order-card-actions">
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => openDetail(o.id)}
                        >
                          Chi tiết
                        </button>
                        <span className="order-amount">
                          {Number(o.totalAmount).toLocaleString("vi-VN")} đ
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <AppPagination
                currentPage={page}
                pageCount={totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </div>

      {selectedOrder && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="modal-content order-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setSelectedOrder(null)}
            >
              <X size={24} />
            </button>
            <h2>{selectedOrder.eventTitle}</h2>
            <p className="modal-meta">
              {formatDate(selectedOrder.eventStartDatetime)}
              {selectedOrder.eventVenueName && ` • ${selectedOrder.eventVenueName}`}
            </p>
            <div className="order-detail-info">
              <div className="info-row">
                <span className="label">Mã đơn</span>
                <span className="value">{selectedOrder.orderNumber}</span>
              </div>
              <div className="info-row">
                <span className="label">Trạng thái</span>
                <span
                  className={`value order-detail-status ${statusLabel(selectedOrder.status).cls}`}
                >
                  {statusLabel(selectedOrder.status).text}
                </span>
              </div>
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div className="order-items">
                  <p className="items-label">Chi tiết vé</p>
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="order-item-row">
                      <span className="order-item-name">{item.ticketTypeName}</span>
                      <span className="order-item-qty">x{item.quantity}</span>
                      <span className="order-item-subtotal">
                        {Number(item.subtotal).toLocaleString("vi-VN")} đ
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="info-row total">
                <span className="label">Tổng cộng</span>
                <span className="value">
                  {Number(selectedOrder.totalAmount).toLocaleString("vi-VN")} đ
                </span>
              </div>
            </div>
            {selectedOrder.status === "PENDING" && (
              <button
                className="btn btn-outline btn-danger"
                onClick={() => void handleCancel(selectedOrder.id)}
                disabled={cancelling === selectedOrder.id}
              >
                {cancelling === selectedOrder.id ? "Đang hủy" : "Hủy đơn hàng"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
