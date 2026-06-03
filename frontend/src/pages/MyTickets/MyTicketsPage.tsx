import { useEffect, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { Ticket, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import AccountSidebar from "../../components/account/AccountSidebar";
import AppPagination from "../../components/common/AppPagination";
import AccountCategoryNav from "../../components/common/AccountCategoryNav";
import {
  ticketService,
  TicketSummary,
  TicketsPageResponse,
} from "../../services/ticketService";

const PAGE_SIZE = 5;
type TicketStatusFilter = "ALL" | "VALID" | "USED" | "CANCELLED";

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

function formatCurrency(value: number | string, language: string) {
  return `${Number(value).toLocaleString(language === "en" ? "en-US" : "vi-VN")} đ`;
}

function statusLabel(status: string, t: (key: string) => string) {
  switch (status) {
    case "VALID":
      return { text: t("status.valid"), cls: "status-valid" };
    case "USED":
      return { text: t("status.used"), cls: "status-used" };
    case "CANCELLED":
      return { text: t("status.cancelled"), cls: "status-cancelled" };
    default:
      return { text: status, cls: "" };
  }
}

export default function MyTicketsPage() {
  const { i18n, t } = useTranslation();
  const { keycloak, initialized } = useKeycloak();
  const [data, setData] = useState<TicketsPageResponse | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TicketStatusFilter>("ALL");
  const [selectedTicket, setSelectedTicket] = useState<TicketSummary | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const language = i18n.resolvedLanguage || "vi";

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
        if (!cancelled) setError(t("ticketsPage.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [initialized, keycloak, keycloak.authenticated, page, t]);

  const openTicketDetail = async (ticket: TicketSummary) => {
    setSelectedTicket(ticket);
    setDetailLoading(true);
    try {
      const detail = await ticketService.getTicketDetail(ticket.id);
      if (detail) {
        setSelectedTicket(detail);
      } else {
        toast.warning(t("ticketsPage.detailFallback"));
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
    { value: "ALL", label: t("status.all") },
    { value: "VALID", label: t("status.success") },
    { value: "USED", label: t("status.used") },
    { value: "CANCELLED", label: t("status.cancelled") },
  ];

  if (!initialized || !keycloak.authenticated) return null;

  return (
    <div className="my-tickets-page">
      <AccountCategoryNav />
      <div className="container account-layout-container">
        <AccountSidebar />

        <div className="account-main-content">
          <h1 className="page-title">{t("ticketsPage.title")}</h1>

          {loading ? (
            <div className="list-loading">
              <div className="loading-spinner"></div>
              <span>{t("ticketsPage.loading")}</span>
            </div>
          ) : error ? (
            <div className="list-error">{error}</div>
          ) : !data || tickets.length === 0 ? (
            <div className="list-empty">
              <Ticket size={48} />
              <p>{t("ticketsPage.empty")}</p>
              <Link to="/search" className="btn btn-primary">
                {t("ticketsPage.exploreEvents")}
              </Link>
            </div>
          ) : (
            <>
              <div className="my-ticket-status-tabs" aria-label={t("ticketsPage.filterLabel")}>
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
                  <p>{t("ticketsPage.filterEmpty")}</p>
                </div>
              ) : (
                <div className="ticket-list">
                  {filteredTickets.map((ticket) => {
                    const sl = statusLabel(ticket.status, t);
                    return (
                      <div key={ticket.id} className="ticket-card" onClick={() => void openTicketDetail(ticket)}>
                        <div className="ticket-card-main">
                          <h3 className="ticket-event-title">{ticket.eventTitle}</h3>
                          <p className="ticket-meta">
                            {formatDate(ticket.eventStartDatetime, language)}
                            {ticket.eventVenueName ? ` • ${ticket.eventVenueName}` : ""}
                          </p>
                          <div className="ticket-card-footer">
                            <span className="ticket-type">{ticket.ticketTypeName}</span>
                            {ticket.seatLabel ? <span className="ticket-seat">{t("ticketsPage.seat")}: {ticket.seatLabel}</span> : null}
                            <span className={`ticket-status ${sl.cls}`}>{sl.text}</span>
                          </div>
                        </div>
                        <div className="ticket-card-action">
                          <span className="view-detail">{t("ticketsPage.viewDetail")}</span>
                        </div>
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
              <div className="modal-inline-loading">
                <div className="loading-spinner"></div>
                <span>{t("ticketsPage.loadDetail")}</span>
              </div>
            ) : null}
            <h2>{selectedTicket.eventTitle}</h2>
            <p className="modal-meta">
              <span style={{ opacity: 0.8 }}>{t("ticketsPage.eventTime")} </span>
              {formatDate(selectedTicket.eventStartDatetime, language)}
              {selectedTicket.eventVenueName ? ` • ${selectedTicket.eventVenueName}` : ""}
            </p>
            <div className="ticket-detail-layout">
              <div className="ticket-detail-info">
                <div className="info-row"><span className="label">{t("ticketsPage.code")}</span><span className="value">{selectedTicket.ticketCode}</span></div>
                <div className="info-row"><span className="label">{t("ticketsPage.purchaseTime")}</span><span className="value">{formatDate(selectedTicket.createdAt, language)}</span></div>
                <div className="info-row"><span className="label">{t("ticketsPage.ticketType")}</span><span className="value">{selectedTicket.ticketTypeName}</span></div>
                {selectedTicket.seatLabel ? <div className="info-row"><span className="label">{t("ticketsPage.seat")}</span><span className="value">{selectedTicket.seatLabel}</span></div> : null}
                {selectedTicket.holderName ? <div className="info-row"><span className="label">{t("ticketsPage.holder")}</span><span className="value">{selectedTicket.holderName}</span></div> : null}
                {selectedTicket.holderEmail ? <div className="info-row"><span className="label">Email</span><span className="value">{selectedTicket.holderEmail}</span></div> : null}
                <div className="info-row"><span className="label">{t("ticketsPage.price")}</span><span className="value">{formatCurrency(selectedTicket.price, language)}</span></div>
                <div className="info-row"><span className="label">{t("ticketsPage.status")}</span><span className={`value ${statusLabel(selectedTicket.status, t).cls}`}>{statusLabel(selectedTicket.status, t).text}</span></div>
                {selectedTicket.checkedInAt ? <div className="info-row"><span className="label">{t("ticketsPage.checkedInAt")}</span><span className="value">{formatDate(selectedTicket.checkedInAt, language)}</span></div> : null}
              </div>
              {selectedTicket.qrCodeData && selectedTicket.status === "VALID" ? (
                <div className="qr-section">
                  <p className="qr-label">{t("ticketsPage.qrLabel")}</p>
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
