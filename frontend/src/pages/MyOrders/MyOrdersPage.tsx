import { useEffect, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Link } from "react-router-dom";
import {
  orderService,
  OrderSummary,
  OrderDetail,
} from "../../services/orderService";
import {
  ShoppingBag,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

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
  const { keycloak } = useKeycloak();
  const [content, setContent] = useState<OrderSummary[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [number, setNumber] = useState(0);
  const [first, setFirst] = useState(true);
  const [last, setLast] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

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
          setNumber(res.number);
          setFirst(res.first);
          setLast(res.last);
        }
      } catch (e) {
        if (!cancelled) setError("Không thể tải danh sách đơn hàng.");
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
    }
  };

  const handleCancel = async (orderId: string) => {
    if (!confirm("Bạn có chắc muốn hủy đơn hàng này?")) return;
    setCancelling(orderId);
    try {
      await orderService.cancelOrder(orderId);
      setSelectedOrder(null);
      const res = await orderService.getMyOrders(page, 10);
      setContent(res.content);
      setTotalPages(res.totalPages);
      setNumber(res.number);
      setFirst(res.first);
      setLast(res.last);
    } catch {
      alert("Không thể hủy đơn hàng.");
    } finally {
      setCancelling(null);
    }
  };

  if (!keycloak.authenticated) {
    return (
      <div className="my-orders-page">
        <div className="container">
          <p>Vui lòng đăng nhập để xem đơn hàng.</p>
          <button onClick={() => keycloak.login()} className="btn btn-primary">
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-orders-page">
      <div className="container">
        <Link to="/" className="back-link">
          <ArrowLeft size={18} />
          Về trang chủ
        </Link>

        <h1 className="page-title">Đơn hàng của tôi</h1>

        {loading ? (
          <div className="list-loading">
            <div className="loading-spinner"></div>
            <span>Đang tải...</span>
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
                        {formatDate(o.eventStartDatetime)} • Mã đơn:{" "}
                        {o.orderNumber}
                      </p>
                      <div className="order-card-footer">
                        <span className="order-amount">
                          {Number(o.totalAmount).toLocaleString("vi-VN")} đ
                        </span>
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
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  className="btn btn-outline"
                  disabled={first}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft size={18} />
                  Trước
                </button>
                <span className="pagination-info">
                  Trang {number + 1} / {totalPages}
                </span>
                <button
                  className="btn btn-outline"
                  disabled={last}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Sau
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
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
                  className={`value ${statusLabel(selectedOrder.status).cls}`}
                >
                  {statusLabel(selectedOrder.status).text}
                </span>
              </div>
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div className="order-items">
                  <p className="items-label">Chi tiết vé</p>
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="order-item-row">
                      <span>{item.ticketTypeName}</span>
                      <span>x{item.quantity}</span>
                      <span>
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
                onClick={() => handleCancel(selectedOrder.id)}
                disabled={cancelling === selectedOrder.id}
              >
                {cancelling === selectedOrder.id ? "Đang hủy..." : "Hủy đơn hàng"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
