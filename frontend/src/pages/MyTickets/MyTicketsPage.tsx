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
import { Search, Ticket, X } from "lucide-react";

const PAGE_SIZE = 10;
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
  const { keycloak } = useKeycloak();
  const [data, setData] = useState<TicketsPageResponse | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatusFilter>("ALL");
  const [searchValue, setSearchValue] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<TicketSummary | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!keycloak.authenticated) return;
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
  }, [keycloak.authenticated, page]);

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

  const tickets = data?.content ?? [];
  const keyword = searchValue.trim().toLowerCase();
  const filteredTickets = tickets.filter((ticket) => {
    if (statusFilter !== "ALL" && ticket.status !== statusFilter) return false;
    if (!keyword) return true;
    return (
      ticket.eventTitle.toLowerCase().includes(keyword) ||
      ticket.ticketCode.toLowerCase().includes(keyword) ||
      ticket.ticketTypeName.toLowerCase().includes(keyword)
    );
  });

  const validCount = tickets.filter((ticket) => ticket.status === "VALID").length;
  const usedCount = tickets.filter((ticket) => ticket.status === "USED").length;
  const cancelledCount = tickets.filter(
    (ticket) => ticket.status === "CANCELLED",
  ).length;
  const isFiltering = statusFilter !== "ALL" || keyword.length > 0;

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
              <div className="ticket-summary-strip">
                <div className="ticket-summary-pill">
                  <span>Tổng vé trang này</span>
                  <strong>{tickets.length}</strong>
                </div>
                <div className="ticket-summary-pill">
                  <span>Hợp lệ</span>
                  <strong>{validCount}</strong>
                </div>
                <div className="ticket-summary-pill">
                  <span>Đã sử dụng</span>
                  <strong>{usedCount}</strong>
                </div>
                <div className="ticket-summary-pill">
                  <span>Đã hủy</span>
                  <strong>{cancelledCount}</strong>
                </div>
              </div>

              <div className="ticket-tools">
                <div className="ticket-search-field">
                  <Search size={16} />
                  <input
                    type="text"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="Tìm theo tên sự kiện, mã vé, loại vé"
                  />
                </div>

                <select
                  className="ticket-status-filter"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as TicketStatusFilter)
                  }
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="VALID">Hợp lệ</option>
                  <option value="USED">Đã sử dụng</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>

                {isFiltering ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setStatusFilter("ALL");
                      setSearchValue("");
                    }}
                  >
                    Xóa lọc
                  </button>
                ) : null}
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
                      <div
                        key={ticket.id}
                        className="ticket-card"
                        onClick={() => void openTicketDetail(ticket)}
                      >
                        <div className="ticket-card-main">
                          <h3 className="ticket-event-title">{ticket.eventTitle}</h3>
                          <p className="ticket-meta">
                            {formatDate(ticket.eventStartDatetime)}
                            {ticket.eventVenueName
                              ? ` • ${ticket.eventVenueName}`
                              : ""}
                          </p>
                          <div className="ticket-card-footer">
                            <span className="ticket-type">{ticket.ticketTypeName}</span>
                            {ticket.seatLabel ? (
                              <span className="ticket-seat">Ghế: {ticket.seatLabel}</span>
                            ) : null}
                            <span className={`ticket-status ${sl.cls}`}>{sl.text}</span>
                          </div>
                        </div>
                        <div className="ticket-card-action">
                          <span className="view-detail">Xem chi tiết</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <AppPagination
                currentPage={data.number}
                pageCount={data.totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </div>

      {selectedTicket ? (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-content ticket-detail-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="modal-close" onClick={closeModal}>
              <X size={24} />
            </button>
            {detailLoading ? (
              <div className="modal-inline-loading">
                <div className="loading-spinner"></div>
                <span>Đang tải chi tiết vé mới nhất...</span>
              </div>
            ) : null}
            <h2>{selectedTicket.eventTitle}</h2>
            <p className="modal-meta">
              {formatDate(selectedTicket.eventStartDatetime)}
              {selectedTicket.eventVenueName
                ? ` • ${selectedTicket.eventVenueName}`
                : ""}
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
              {selectedTicket.seatLabel ? (
                <div className="info-row">
                  <span className="label">Ghế</span>
                  <span className="value">{selectedTicket.seatLabel}</span>
                </div>
              ) : null}
              {selectedTicket.holderName ? (
                <div className="info-row">
                  <span className="label">Người sở hữu</span>
                  <span className="value">{selectedTicket.holderName}</span>
                </div>
              ) : null}
              {selectedTicket.holderEmail ? (
                <div className="info-row">
                  <span className="label">Email</span>
                  <span className="value">{selectedTicket.holderEmail}</span>
                </div>
              ) : null}
              <div className="info-row">
                <span className="label">Giá</span>
                <span className="value">
                  {Number(selectedTicket.price).toLocaleString("vi-VN")} đ
                </span>
              </div>
              <div className="info-row">
                <span className="label">Trạng thái</span>
                <span className={`value ${statusLabel(selectedTicket.status).cls}`}>
                  {statusLabel(selectedTicket.status).text}
                </span>
              </div>
              {selectedTicket.checkedInAt ? (
                <div className="info-row">
                  <span className="label">Thời gian check-in</span>
                  <span className="value">
                    {formatDate(selectedTicket.checkedInAt)}
                  </span>
                </div>
              ) : null}
            </div>
            {selectedTicket.qrCodeData && selectedTicket.status === "VALID" ? (
              <div className="qr-section">
                <p className="qr-label">Mã QR (quét tại cổng)</p>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(selectedTicket.qrCodeData)}`}
                  alt="QR Code"
                  className="qr-image"
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
