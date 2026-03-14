import { useEffect, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Link } from "react-router-dom";
import AccountSidebar from "../../components/account/AccountSidebar";
import AppPagination from "../../components/common/AppPagination";
import {
  ticketService,
  TicketSummary,
  TicketsPageResponse,
} from "../../services/ticketService";
import { Ticket, X } from "lucide-react";

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
  const { keycloak } = useKeycloak();
  const [data, setData] = useState<TicketsPageResponse | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<TicketSummary | null>(null);

  useEffect(() => {
    if (!keycloak.authenticated) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await ticketService.getMyTickets(page, 10);
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError("Không thể tải danh sách vé.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [keycloak.authenticated, page]);

  if (!keycloak.authenticated) {
    return (
      <div className="my-tickets-page">
        <div className="container">
          <p>Vui lòng đăng nhập để xem vé của bạn.</p>
          <button onClick={() => keycloak.login()} className="btn btn-primary">
            Đăng nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-tickets-page">
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
          ) : !data || data.content.length === 0 ? (
            <div className="list-empty">
              <Ticket size={48} />
              <p>Bạn chưa có vé nào.</p>
              <Link to="/search" className="btn btn-primary">
                Khám phá sự kiện
              </Link>
            </div>
          ) : (
            <>
              <div className="ticket-list">
                {data.content.map((t) => {
                  const sl = statusLabel(t.status);
                  return (
                    <div
                      key={t.id}
                      className="ticket-card"
                      onClick={() => setSelectedTicket(t)}
                    >
                      <div className="ticket-card-main">
                        <h3 className="ticket-event-title">{t.eventTitle}</h3>
                        <p className="ticket-meta">
                          {formatDate(t.eventStartDatetime)}
                          {t.eventVenueName && ` • ${t.eventVenueName}`}
                        </p>
                        <div className="ticket-card-footer">
                          <span className="ticket-type">{t.ticketTypeName}</span>
                          {t.seatLabel && (
                            <span className="ticket-seat">Ghế: {t.seatLabel}</span>
                          )}
                          <span className={`ticket-status ${sl.cls}`}>
                            {sl.text}
                          </span>
                        </div>
                      </div>
                      <div className="ticket-card-action">
                        <span className="view-detail">Xem chi tiết</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <AppPagination
                currentPage={data.number}
                pageCount={data.totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </div>

      {selectedTicket && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedTicket(null)}
        >
          <div
            className="modal-content ticket-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setSelectedTicket(null)}
            >
              <X size={24} />
            </button>
            <h2>{selectedTicket.eventTitle}</h2>
            <p className="modal-meta">
              {formatDate(selectedTicket.eventStartDatetime)}
              {selectedTicket.eventVenueName && ` • ${selectedTicket.eventVenueName}`}
            </p>
            <div className="ticket-detail-info">
              <div className="info-row">
                <span className="label">Mã vé</span>
                <span className="value">{selectedTicket.ticketCode}</span>
              </div>
              <div className="info-row">
                <span className="label">Loại vé</span>
                <span className="value">{selectedTicket.ticketTypeName}</span>
              </div>
              {selectedTicket.seatLabel && (
                <div className="info-row">
                  <span className="label">Ghế</span>
                  <span className="value">{selectedTicket.seatLabel}</span>
                </div>
              )}
              <div className="info-row">
                <span className="label">Giá</span>
                <span className="value">
                  {Number(selectedTicket.price).toLocaleString("vi-VN")} đ
                </span>
              </div>
              <div className="info-row">
                <span className="label">Trạng thái</span>
                <span
                  className={`value ${statusLabel(selectedTicket.status).cls}`}
                >
                  {statusLabel(selectedTicket.status).text}
                </span>
              </div>
            </div>
            {selectedTicket.qrCodeData && selectedTicket.status === "VALID" && (
              <div className="qr-section">
                <p className="qr-label">Mã QR (quét tại cổng)</p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(selectedTicket.qrCodeData)}`}
                  alt="QR Code"
                  className="qr-image"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
