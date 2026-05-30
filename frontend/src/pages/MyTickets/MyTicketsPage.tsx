import { useEffect, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import AccountSidebar from "../../components/account/AccountSidebar";
import AppPagination from "../../components/common/AppPagination";
import {
  ticketService,
  TicketSummary,
  TicketsPageResponse,
} from "../../services/ticketService";
import { Ticket, X } from "lucide-react";
import AccountCategoryNav from "../../components/common/AccountCategoryNav";

const PAGE_SIZE = 5;
type TicketStatusFilter = "ALL" | "VALID" | "USED" | "CANCELLED";

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
    case "VALID":
      return { text: "Hợp lệ", cls: "status-valid" };
    case "USED":
      return { text: "Đã sử dụng", cls: "status-used" };
    case "CANCELLED":
      return { text: "Đã hủy", cls: "status-cancelled" };
    default:
      return { text: status, cls: "" };
  }
}

export default function MyTicketsPage() {
  const { keycloak, initialized } = useKeycloak();
  const [data, setData] = useState<TicketsPageResponse | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatusFilter>("ALL");
  const [selectedTicket, setSelectedTicket] = useState<TicketSummary | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!initialized) return;
    if (!keycloak.authenticated) {
      void keycloak.login({
        redirectUri: `${window.location.origin}/my-tickets`,
      });
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await ticketService.getMyTickets(page, PAGE_SIZE);
        if (!cancelled) setData(res);
      } catch {
        if (!cancelled) setError("Không thể tải danh sách vé.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [initialized, keycloak, keycloak.authenticated, page]);

  const openTicketDetail = async (ticket: TicketSummary) => {
    setSelectedTicket(ticket);
    setDetailLoading(true);
    try {
      const detail = await ticketService.getTicketDetail(ticket.id);
      if (detail) {
        setSelectedTicket(detail);
      } else {
        toast.warning(
          "Không lấy được chi tiết vé mới nhất, đang hiển thị dữ liệu tóm tắt.",
        );
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedTicket(null);
    setDetailLoading(false);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const tickets = data?.content ?? [];
  const filteredTickets = tickets.filter((ticket) => {
    if (statusFilter !== "ALL" && ticket.status !== statusFilter) return false;
    return true;
  });
  const ticketStatusTabs: Array<{ value: TicketStatusFilter; label: string }> = [
    { value: "ALL", label: "Tất cả" },
    { value: "VALID", label: "Thành công" },
    { value: "USED", label: "Đã sử dụng" },
    { value: "CANCELLED", label: "Đã hủy" },
  ];

  if (!initialized || !keycloak.authenticated) return null;

  return (
    <div className="my-tickets-page">
      <AccountCategoryNav />
      <div className="container account-layout-container">
        <AccountSidebar />

        <div className="account-main-content">
          <h1 className="page-title">Vé của tôi</h1>

          {loading ? (
            <div className="list-loading">
              <div className="loading-spinner"></div>
              <span>Đang tải</span>
            </div>
          ) : error ? (
            <div className="list-error">{error}</div>
          ) : !data || tickets.length === 0 ? (
            <div className="list-empty">
              <Ticket size={48} />
              <p>Bạn chưa có vé nào.</p>
              <Link to="/search" className="btn btn-primary">
                Khám phá sự kiện
              </Link>
            </div>
          ) : (
            <>
              <div className="my-ticket-status-tabs" aria-label="Lọc trạng thái vé">
                {ticketStatusTabs.map((tab) => (
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

              {filteredTickets.length === 0 ? (
                <div className="list-empty ticket-filter-empty">
                  <Ticket size={36} />
                  <p>Không có vé nào phù hợp với bộ lọc hiện tại.</p>
                </div>
              ) : (
                <div className="ticket-list">
                  {filteredTickets.map((ticket) => {
                    const sl = statusLabel(ticket.status);
                    return (
                      <div key={ticket.id} className="ticket-card" onClick={() => void openTicketDetail(ticket)}>
                        <div className="ticket-card-main">
                          <h3 className="ticket-event-title">{ticket.eventTitle}</h3>
                          <p className="ticket-meta">
                            {formatDate(ticket.eventStartDatetime)}
                            {ticket.eventVenueName ? ` • ${ticket.eventVenueName}` : ""}
                          </p>
                          <div className="ticket-card-footer">
                            <span className="ticket-type">{ticket.ticketTypeName}</span>
                            {ticket.seatLabel ? <span className="ticket-seat">Ghế: {ticket.seatLabel}</span> : null}
                            <span className={`ticket-status ${sl.cls}`}>{sl.text}</span>
                          </div>
                        </div>
                        <div className="ticket-card-action"><span className="view-detail">Xem chi tiết</span></div>
                      </div>
                    );
                  })}
                </div>
              )}

              <AppPagination
                currentPage={data.number}
                pageCount={data.totalPages}
                onPageChange={handlePageChange}
                pageRangeDisplayed={4}
                marginPagesDisplayed={1}
                showPageInfo={false}
              />
            </>
          )}
        </div>
      </div>

      {selectedTicket ? (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content ticket-detail-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}><X size={24} /></button>
            {detailLoading ? (
              <div className="modal-inline-loading"><div className="loading-spinner"></div><span>Đang tải chi tiết vé mới nhất...</span></div>
            ) : null}
            <h2>{selectedTicket.eventTitle}</h2>
            <p className="modal-meta">
              <span style={{ opacity: 0.8 }}>Thời gian sự kiện: </span>
              {formatDate(selectedTicket.eventStartDatetime)}
              {selectedTicket.eventVenueName ? ` • ${selectedTicket.eventVenueName}` : ""}
            </p>
            <div className="ticket-detail-layout">
              <div className="ticket-detail-info">
                <div className="info-row"><span className="label">Mã vé</span><span className="value">{selectedTicket.ticketCode}</span></div>
                <div className="info-row"><span className="label">Thời gian mua</span><span className="value">{formatDate(selectedTicket.createdAt)}</span></div>
                <div className="info-row"><span className="label">Loại vé</span><span className="value">{selectedTicket.ticketTypeName}</span></div>
                {selectedTicket.seatLabel ? <div className="info-row"><span className="label">Ghế</span><span className="value">{selectedTicket.seatLabel}</span></div> : null}
                {selectedTicket.holderName ? <div className="info-row"><span className="label">Người sở hữu</span><span className="value">{selectedTicket.holderName}</span></div> : null}
                {selectedTicket.holderEmail ? <div className="info-row"><span className="label">Email</span><span className="value">{selectedTicket.holderEmail}</span></div> : null}
                <div className="info-row"><span className="label">Giá</span><span className="value">{Number(selectedTicket.price).toLocaleString("vi-VN")} đ</span></div>
                <div className="info-row"><span className="label">Trạng thái</span><span className={`value ${statusLabel(selectedTicket.status).cls}`}>{statusLabel(selectedTicket.status).text}</span></div>
                {selectedTicket.checkedInAt ? <div className="info-row"><span className="label">Thời gian check-in</span><span className="value">{formatDate(selectedTicket.checkedInAt)}</span></div> : null}
              </div>
              {selectedTicket.qrCodeData && selectedTicket.status === "VALID" ? (
                <div className="qr-section">
                  <p className="qr-label">Mã QR (quét tại cổng)</p>
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(selectedTicket.qrCodeData)}`} alt="QR Code" className="qr-image" />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
