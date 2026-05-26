import { useEffect, useMemo, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { Search, ShoppingBag, X } from "lucide-react";
import AccountSidebar from "../../components/account/AccountSidebar";
import AppPagination from "../../components/common/AppPagination";
import { confirmDestructiveAction } from "../../lib/swal";
import { orderService, OrderDetail, OrderSummary } from "../../services/orderService";
import AccountCategoryNav from "../../components/common/AccountCategoryNav";

type OrderStatusFilter = "ALL" | "PENDING" | "CONFIRMED" | "CANCELLED" | "REFUNDED" | "EXPIRED";

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
  const [content, setContent] = useState<OrderSummary[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("ALL");
  const [searchValue, setSearchValue] = useState("");

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
        const res = await orderService.getMyOrders(page, 10);
        if (!cancelled) {
          setContent(res.content);
          setTotalPages(res.totalPages);
        }
      } catch {
        if (!cancelled) {
          setError("Không thể tải danh sách đơn hàng.");
          toast.error("Không thể tải danh sách đơn hàng.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
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

  const keyword = searchValue.trim().toLowerCase();
  const filteredOrders = useMemo(() => {
    return content.filter((order) => {
      if (statusFilter !== "ALL" && order.status !== statusFilter) return false;
      if (!keyword) return true;
      return (
        order.eventTitle.toLowerCase().includes(keyword) ||
        order.orderNumber.toLowerCase().includes(keyword)
      );
    });
  }, [content, keyword, statusFilter]);

  const pendingCount = content.filter((order) => order.status === "PENDING").length;
  const confirmedCount = content.filter((order) => order.status === "CONFIRMED").length;
  const refundedCount = content.filter((order) => order.status === "REFUNDED").length;
  const isFiltering = statusFilter !== "ALL" || keyword.length > 0;

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
              <div className="ticket-summary-strip">
                <div className="ticket-summary-pill"><span>Tổng đơn trang này</span><strong>{content.length}</strong></div>
                <div className="ticket-summary-pill"><span>Chờ thanh toán</span><strong>{pendingCount}</strong></div>
                <div className="ticket-summary-pill"><span>Đã xác nhận</span><strong>{confirmedCount}</strong></div>
                <div className="ticket-summary-pill"><span>Đã hoàn tiền</span><strong>{refundedCount}</strong></div>
              </div>

              <div className="ticket-tools">
                <div className="ticket-search-field">
                  <Search size={16} />
                  <input type="text" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Tìm theo tên sự kiện hoặc mã đơn" />
                </div>
                <select className="ticket-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as OrderStatusFilter)}>
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="PENDING">Chờ thanh toán</option>
                  <option value="CONFIRMED">Đã xác nhận</option>
                  <option value="CANCELLED">Đã hủy</option>
                  <option value="EXPIRED">Hết hạn</option>
                  <option value="REFUNDED">Đã hoàn tiền</option>
                </select>
                {isFiltering ? (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => { setStatusFilter("ALL"); setSearchValue(""); }}>
                    Xóa lọc
                  </button>
                ) : null}
              </div>

              {filteredOrders.length === 0 ? (
                <div className="list-empty ticket-filter-empty">
                  <ShoppingBag size={36} />
                  <p>Không có đơn hàng phù hợp với bộ lọc hiện tại.</p>
                </div>
              ) : (
                <div className="order-list">
                  {filteredOrders.map((order) => {
                    const sl = statusLabel(order.status);
                    return (
                      <div key={order.id} className="order-card">
                        <div className="order-card-main">
                          <h3 className="order-event-title">{order.eventTitle}</h3>
                          <p className="order-meta">Ngày đặt: {formatDate(order.createdAt)} • Mã đơn: {order.orderNumber}</p>
                          <div className="order-card-footer"><span className={`order-status ${sl.cls}`}>{sl.text}</span></div>
                        </div>
                        <div className="order-card-actions">
                          <button className="btn btn-outline btn-sm" onClick={() => void openDetail(order.id)}>Chi tiết</button>
                          <span className="order-amount">{Number(order.totalAmount).toLocaleString("vi-VN")} đ</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <AppPagination currentPage={page} pageCount={totalPages} onPageChange={setPage} />
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
              <span style={{ opacity: 0.8 }}>Thời gian sự kiện: </span>
              {formatDate(selectedOrder.eventStartDatetime)}
              {selectedOrder.eventVenueName && ` • ${selectedOrder.eventVenueName}`}
            </p>
            <div className="order-detail-info">
              <div className="info-row"><span className="label">Mã đơn</span><span className="value">{selectedOrder.orderNumber}</span></div>
              <div className="info-row"><span className="label">Thời gian đặt</span><span className="value">{formatDate(selectedOrder.createdAt)}</span></div>
              {selectedOrder.paidAt ? (
                <div className="info-row"><span className="label">Thời gian thanh toán</span><span className="value">{formatDate(selectedOrder.paidAt)}</span></div>
              ) : null}
              <div className="info-row"><span className="label">Trạng thái</span><span className={`value order-detail-status ${statusLabel(selectedOrder.status).cls}`}>{statusLabel(selectedOrder.status).text}</span></div>
              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div className="order-items">
                  <p className="items-label">Chi tiết vé</p>
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="order-item-row">
                      <span className="order-item-name">{item.ticketTypeName}</span>
                      <span className="order-item-qty">x{item.quantity}</span>
                      <span className="order-item-subtotal">{Number(item.subtotal).toLocaleString("vi-VN")} đ</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="info-row total"><span className="label">Tổng cộng</span><span className="value">{Number(selectedOrder.totalAmount).toLocaleString("vi-VN")} đ</span></div>
            </div>
            {selectedOrder.status === "PENDING" && (
              <button className="btn btn-outline btn-danger" onClick={() => void handleCancel(selectedOrder.id)} disabled={cancelling === selectedOrder.id}>
                {cancelling === selectedOrder.id ? "Đang hủy" : "Hủy đơn hàng"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
