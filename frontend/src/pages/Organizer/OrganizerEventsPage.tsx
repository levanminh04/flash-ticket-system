import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import Chart from "react-apexcharts";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  Edit,
  Eye,
  ImagePlus,
  LoaderCircle,
  Search,
  Ticket,
  Trash2,
} from "lucide-react";
import { ApexOptions } from "apexcharts";
import { FaCalendarCheck, FaFileSignature } from "react-icons/fa6";
import { CgPushUp } from "react-icons/cg";
import { HiBadgeCheck } from "react-icons/hi";
import { HiTicket } from "react-icons/hi2";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import AppPagination from "../../components/common/AppPagination";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import { confirmDestructiveAction } from "../../lib/swal";
import {
  organizerWorkspaceService,
  OrganizerEventDetail,
} from "../../services/organizerWorkspaceService";
import { SpringPage } from "../../types/api";
import {
  formatDateTime,
  getEventEstimatedRevenue,
  getEventTicketCapacity,
  getEventTicketsSold,
} from "./organizerWorkspaceUtils";
import { useOrganizerGate } from "./useOrganizerGate";

const PAGE_SIZE = 10;
const ANALYTICS_PAGE_SIZE = 100;

type EventListFilter = "all" | "published" | "draft" | "sold_out" | "cancelled";
type EventStatusKey = "DRAFT" | "PUBLISHED" | "SOLD_OUT" | "CANCELLED" | "OTHER";
type TranslationFn = (key: string) => string;

const eventListFilters: Array<{ value: EventListFilter; label: string }> = [
  { value: "all", label: "common.all" },
  { value: "published", label: "status.published" },
  { value: "draft", label: "status.draft" },
  { value: "sold_out", label: "status.soldOut" },
  { value: "cancelled", label: "status.cancelled" },
];

const eventStatusMeta: Record<EventStatusKey, { label: string; className: string }> = {
  DRAFT: { label: "status.draft", className: "is-draft" },
  PUBLISHED: { label: "status.published", className: "is-published" },
  SOLD_OUT: { label: "status.soldOut", className: "is-sold-out" },
  CANCELLED: { label: "status.cancelled", className: "is-cancelled" },
  OTHER: { label: "status.other", className: "is-draft" },
};

function numberFormat(value: number | null | undefined, language: string): string {
  return Number(value ?? 0).toLocaleString(language === "en" ? "en-US" : "vi-VN");
}

function currencyFormat(value: number, language: string): string {
  return `${Math.round(value).toLocaleString(language === "en" ? "en-US" : "vi-VN")} đ`;
}

function getEventStatus(status?: string): EventStatusKey {
  if (
    status === "DRAFT" ||
    status === "PUBLISHED" ||
    status === "SOLD_OUT" ||
    status === "CANCELLED"
  ) {
    return status;
  }
  return "OTHER";
}

function getFilterStatus(filter: EventListFilter): EventStatusKey | null {
  if (filter === "published") return "PUBLISHED";
  if (filter === "draft") return "DRAFT";
  if (filter === "sold_out") return "SOLD_OUT";
  if (filter === "cancelled") return "CANCELLED";
  return null;
}

function getEventStartTime(event: OrganizerEventDetail): number {
  const value = event.schedule?.startDatetime;
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getMonthLabel(time: number): string {
  const date = new Date(time);
  return `T${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function getVenueLabel(event: OrganizerEventDetail, t: TranslationFn) {
  if (event.isOnline) return t("organizerEvents.onlineEvent");
  const parts = [
    event.venue?.name,
    event.venue?.address,
    event.venue?.city,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : t("organizerEvents.noVenue");
}

function isPastDate(value?: string | null): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return !Number.isNaN(time) && time < Date.now();
}

function isTicketSaleExpired(event: OrganizerEventDetail): boolean {
  if (isPastDate(event.schedule?.saleEndDatetime)) return true;

  const ticketSaleEnds =
    event.ticketTypes
      ?.map((ticketType) => ticketType.saleEndDatetime)
      .filter(Boolean) ?? [];

  return ticketSaleEnds.length > 0 && ticketSaleEnds.every((value) => isPastDate(value));
}

function getSetupItems(event: OrganizerEventDetail, t: TranslationFn) {
  const items: Array<{ label: string; className: string }> = [];
  if (!event.images?.length) {
    items.push({ label: t("organizerEvents.missingImage"), className: "is-warning" });
  }
  if (!event.ticketTypes?.length) {
    items.push({ label: t("organizerEvents.missingTicket"), className: "is-danger" });
  }
  if (isPastDate(event.schedule?.endDatetime)) {
    items.push({ label: t("organizerEvents.eventTimeExpired"), className: "is-danger" });
  }
  if (isTicketSaleExpired(event)) {
    items.push({ label: t("organizerEvents.ticketSaleExpired"), className: "is-warning" });
  }
  if (items.length === 0) {
    items.push({
      label: event.status === "PUBLISHED" ? t("organizerEvents.onSale") : t("organizerEvents.ready"),
      className: "is-success",
    });
  }
  return items;
}

function getEventOccupancy(event: OrganizerEventDetail): number {
  const capacity = getEventTicketCapacity(event);
  return capacity > 0
    ? Math.min(Math.round((getEventTicketsSold(event) / capacity) * 100), 100)
    : 0;
}

function pickEventCover(event: OrganizerEventDetail) {
  return (
    event.images?.find((image) => image.type === "BANNER")?.url ||
    event.images?.find((image) => image.type === "POSTER")?.url ||
    event.images?.find((image) => image.type === "THUMBNAIL")?.url ||
    event.images?.find((image) => image.isPrimary)?.url ||
    event.images?.[0]?.url ||
    ""
  );
}

function filterEvents(events: OrganizerEventDetail[], keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return events;

  return events.filter((event) => {
    const values = [
      event.title,
      event.slug,
      event.shortDescription,
      event.venue?.name,
      event.venue?.city,
      event.status,
    ];

    return values.some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(normalizedKeyword),
    );
  });
}

async function getAllOrganizerEvents(): Promise<OrganizerEventDetail[]> {
  const firstPage = await organizerWorkspaceService.getMyEvents(
    0,
    ANALYTICS_PAGE_SIZE,
    "createdAt,desc",
  );
  const firstPageEvents = firstPage.content ?? [];

  if (firstPage.totalPages <= 1) return firstPageEvents;

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      organizerWorkspaceService.getMyEvents(
        index + 1,
        ANALYTICS_PAGE_SIZE,
        "createdAt,desc",
      ),
    ),
  );

  return [
    ...firstPageEvents,
    ...remainingPages.flatMap((page) => page.content ?? []),
  ];
}

export default function OrganizerEventsPage() {
  const { ready } = useOrganizerGate();
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const [keywordInput, setKeywordInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [pageData, setPageData] =
    useState<SpringPage<OrganizerEventDetail> | null>(null);
  const [allEvents, setAllEvents] = useState<OrganizerEventDetail[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchResults, setSearchResults] = useState<
    OrganizerEventDetail[] | null
  >(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [lightboxSlides, setLightboxSlides] = useState<
    Array<{ src: string; alt: string }>
  >([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [eventListFilter, setEventListFilter] =
    useState<EventListFilter>("all");
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    if (!ready) return;
    if (searchResults !== null) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const data = await organizerWorkspaceService.getMyEvents(
          currentPage,
          PAGE_SIZE,
          "createdAt,desc",
        );
        if (!cancelled) {
          setPageData(data);
        }
      } catch {
        if (!cancelled) {
          toast.error(t("organizerEvents.loadFailed"));
          setPageData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [ready, currentPage, searchResults, t]);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    const loadAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const events = await getAllOrganizerEvents();
        if (!cancelled) setAllEvents(events);
      } catch {
        if (!cancelled) {
          setAllEvents([]);
          toast.error(t("organizerEvents.analyticsLoadFailed"));
        }
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    };

    void loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [ready, t]);

  const baseEvents =
    searchResults ??
    (eventListFilter === "all" ? pageData?.content : allEvents) ??
    [];

  const filteredEvents = useMemo(() => {
    const expectedStatus = getFilterStatus(eventListFilter);
    if (!expectedStatus) return baseEvents;
    return baseEvents.filter((event) => getEventStatus(event.status) === expectedStatus);
  }, [baseEvents, eventListFilter]);

  const pageCount =
    searchResults || eventListFilter !== "all"
      ? Math.ceil(filteredEvents.length / PAGE_SIZE)
      : pageData?.totalPages ?? 0;

  const displayedEvents =
    searchResults || eventListFilter !== "all"
      ? filteredEvents.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
      : filteredEvents;

  const eventFilterCounts = useMemo(() => {
    const source = searchResults ?? allEvents;
    return {
      all: source.length || pageData?.totalElements || baseEvents.length,
      published: source.filter((event) => getEventStatus(event.status) === "PUBLISHED").length,
      draft: source.filter((event) => getEventStatus(event.status) === "DRAFT").length,
      sold_out: source.filter((event) => getEventStatus(event.status) === "SOLD_OUT").length,
      cancelled: source.filter((event) => getEventStatus(event.status) === "CANCELLED").length,
    };
  }, [allEvents, baseEvents.length, pageData?.totalElements, searchResults]);

  const analytics = useMemo(() => {
    const totalEvents = allEvents.length;
    const publishedCount = allEvents.filter((event) => event.status === "PUBLISHED").length;
    const draftCount = allEvents.filter((event) => event.status === "DRAFT").length;
    const totalTicketsSold = allEvents.reduce(
      (sum, event) => sum + getEventTicketsSold(event),
      0,
    );
    const timelineItems = [
      ...allEvents
        .reduce((map, event) => {
          const time = getEventStartTime(event);
          if (time <= 0) return map;
          const key = new Date(time).toISOString().slice(0, 7);
          const existing = map.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            map.set(key, { count: 1, label: getMonthLabel(time), time });
          }
          return map;
        }, new Map<string, { count: number; label: string; time: number }>())
        .values(),
    ].sort((a, b) => a.time - b.time);

    return {
      totalEvents,
      publishedCount,
      draftCount,
      totalTicketsSold,
      timelineItems,
    };
  }, [allEvents]);

  const timelineChartOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: "area",
        toolbar: { show: false },
        fontFamily: "Inter, system-ui, sans-serif",
      },
      colors: ["#10B981"],
      dataLabels: { enabled: false },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.22,
          opacityTo: 0.02,
          stops: [0, 100],
        },
      },
      grid: { borderColor: "#e2e8f0", strokeDashArray: 4 },
      markers: { size: 4, strokeWidth: 2, hover: { size: 6 } },
      stroke: { width: 3, curve: "smooth", lineCap: "round" },
      xaxis: {
        categories: analytics.timelineItems.map((item) => item.label),
        labels: { style: { colors: "#64748b", fontWeight: 600 } },
      },
      yaxis: {
        labels: {
          style: { colors: "#334155", fontWeight: 600 },
          formatter: (value) => numberFormat(value, language),
        },
      },
      tooltip: {
        y: { formatter: (value) => t("organizerEvents.eventCount", { count: numberFormat(value, language) }) },
      },
    }),
    [analytics.timelineItems, language, t],
  );

  const timelineSeries = useMemo(
    () => [
      {
        name: t("organizerEvents.events"),
        data: analytics.timelineItems.map((item) => item.count),
      },
    ],
    [analytics.timelineItems, t],
  );

  const handleSearch = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (!ready) return;

    const nextKeyword = keywordInput.trim();
    if (!nextKeyword) {
      setSearchResults(null);
      setCurrentPage(0);
      return;
    }

    setSearching(true);
    try {
      const totalElements = Math.max(
        pageData?.totalElements ?? PAGE_SIZE,
        PAGE_SIZE,
      );
      const allEventsPage = await organizerWorkspaceService.getMyEvents(
        0,
        totalElements,
        "createdAt,desc",
      );
      setSearchResults(filterEvents(allEventsPage.content, nextKeyword));
      setCurrentPage(0);
    } catch {
      toast.error(t("organizerEvents.searchFailed"));
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = useCallback(async (event: OrganizerEventDetail) => {
    const confirmed = await confirmDestructiveAction({
      title: t("organizer.deleteEventConfirm"),
      text: t("organizer.deleteEventText"),
      confirmButtonText: t("organizer.deleteEvent"),
      cancelButtonText: t("organizer.deleteEventKeep"),
    });
    if (!confirmed) return;

    setDeletingId(event.id);
    try {
      await organizerWorkspaceService.deleteEvent(event.id);
      setPageData((current) => {
        if (!current) return current;
        return {
          ...current,
          content: current.content.filter((item) => item.id !== event.id),
          totalElements: Math.max((current.totalElements ?? 1) - 1, 0),
          numberOfElements: Math.max((current.numberOfElements ?? 1) - 1, 0),
        };
      });
      setAllEvents((current) => current.filter((item) => item.id !== event.id));
      setSearchResults((current) =>
        current ? current.filter((item) => item.id !== event.id) : current,
      );
      toast.success(t("organizer.deleteEventSuccess"));
    } catch {
      toast.error(t("organizer.deleteEventFailed"));
    } finally {
      setDeletingId(null);
    }
  }, [t]);

  const handlePublish = useCallback(async (event: OrganizerEventDetail) => {
    const result = await Swal.fire({
      icon: "question",
      title: t("organizerEvents.publishConfirmTitle"),
      text: t("organizerEvents.publishConfirmText"),
      confirmButtonText: t("organizerEvents.publishConfirmYes"),
      cancelButtonText: t("organizerEvents.publishConfirmNo"),
      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#64748b",
      showCancelButton: true,
      reverseButtons: true,
      focusCancel: true,
      heightAuto: false,
    });

    if (!result.isConfirmed) {
      toast.info(t("organizerEvents.publishCancelled"));
      return;
    }

    setPublishingId(event.id);
    try {
      const nextEvent = await organizerWorkspaceService.publishEvent(event.id);
      const replaceEvent = (item: OrganizerEventDetail) =>
        item.id === nextEvent.id ? nextEvent : item;

      setPageData((current) =>
        current ? { ...current, content: current.content.map(replaceEvent) } : current,
      );
      setAllEvents((current) => current.map(replaceEvent));
      setSearchResults((current) => current ? current.map(replaceEvent) : current);
      toast.success(t("organizerEvents.publishSuccess"));
    } catch {
      toast.error(t("organizerEvents.publishFailed"));
    } finally {
      setPublishingId(null);
    }
  }, [t]);

  const eventColumns = useMemo<ColumnDef<OrganizerEventDetail>[]>(
    () => [
      {
        id: "event",
        accessorFn: (event) => event.title,
        header: t("organizerEvents.events"),
        cell: ({ row }) => {
          const event = row.original;
          const coverUrl = pickEventCover(event);
          const venueLabel = getVenueLabel(event, t);

          return (
            <div className="organizer-event-library-main">
              {coverUrl ? (
                <button
                  type="button"
                  className="organizer-event-library-cover"
                  onClick={() => {
                    setLightboxSlides([{ src: coverUrl, alt: event.title }]);
                    setLightboxIndex(0);
                  }}
                  aria-label={t("organizerEvents.viewBanner", { title: event.title })}
                >
                  <img src={coverUrl} alt="" />
                </button>
              ) : (
                <div className="organizer-event-library-cover-placeholder">
                  <ImagePlus size={20} />
                </div>
              )}
              <div>
                <strong title={event.title}>{event.title}</strong>
                <span title={venueLabel}>{venueLabel}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: "status",
        accessorFn: (event) => getEventStatus(event.status),
        header: t("ticketsPage.status"),
        cell: ({ row }) => {
          const status = getEventStatus(row.original.status);
          const statusMeta = eventStatusMeta[status];

          return (
            <div>
              <span
                className={`organizer-hub-event-status organizer-event-library-status ${statusMeta.className}`}
              >
                {t(statusMeta.label)}
              </span>
            </div>
          );
        },
      },
      {
        id: "schedule",
        accessorFn: (event) => getEventStartTime(event),
        header: t("organizerEvents.schedule"),
        cell: ({ row }) => {
          const event = row.original;

          return (
            <div className="organizer-event-library-time">
              <CalendarClock size={15} />
              <div>
                <span>{formatDateTime(event.schedule?.startDatetime)}</span>
                <small>{formatDateTime(event.schedule?.endDatetime)}</small>
              </div>
            </div>
          );
        },
      },
      {
        id: "ticketSales",
        accessorFn: (event) => getEventTicketsSold(event),
        header: t("organizerEvents.ticketSales"),
        cell: ({ row }) => {
          const event = row.original;
          const ticketsSold = getEventTicketsSold(event);
          const capacity = getEventTicketCapacity(event);
          const occupancy = getEventOccupancy(event);

          return (
            <div className="organizer-event-library-sales">
              <div>
                <strong>
                  {numberFormat(ticketsSold, language)} / {numberFormat(capacity, language)}
                </strong>
                <span>{occupancy}%</span>
              </div>
              <div className="organizer-event-library-progress">
                <span style={{ width: `${occupancy}%` }} />
              </div>
            </div>
          );
        },
      },
      {
        id: "revenue",
        accessorFn: (event) => getEventEstimatedRevenue(event),
        header: t("organizerHub.revenue"),
        cell: ({ getValue }) => (
          <div className="organizer-event-library-revenue">
            {currencyFormat(Number(getValue()), language)}
          </div>
        ),
      },
      {
        id: "setup",
        header: t("organizerEvents.setup"),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="organizer-event-library-setup">
            {getSetupItems(row.original, t).map((item) => (
              <span
                key={item.label}
                className={`organizer-event-library-chip ${item.className}`}
              >
                {item.label}
              </span>
            ))}
          </div>
        ),
      },
      {
        id: "actions",
        header: t("adminOrganizer.tableActions"),
        enableSorting: false,
        cell: ({ row }) => {
          const event = row.original;
          const status = getEventStatus(event.status);
          const canDelete = getEventTicketsSold(event) === 0;

          return (
            <div className="organizer-event-library-actions">
              {status === "PUBLISHED" && event.slug ? (
                <Link
                  className="organizer-event-library-icon-action is-public"
                  to={`/event/${event.slug}`}
                  title={t("organizerEvents.viewPublic")}
                  aria-label={t("organizerEvents.viewPublicEvent", { title: event.title })}
                >
                  <Eye size={16} />
                </Link>
              ) : null}
              {status === "DRAFT" ? (
                <button
                  type="button"
                  className="organizer-event-library-icon-action is-publish"
                  onClick={() => void handlePublish(event)}
                  disabled={publishingId === event.id}
                  title={t("organizerEvents.publishAction")}
                  aria-label={t("organizerEvents.publishEventAria", { title: event.title })}
                >
                  {publishingId === event.id ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <CgPushUp size={18} />
                  )}
                </button>
              ) : null}
              <Link
                className="organizer-event-library-icon-action is-edit"
                to={`/organizer/events/${event.id}/edit`}
                title={t("organizerEvents.edit")}
                aria-label={t("organizerEvents.editEvent", { title: event.title })}
              >
                <Edit size={16} />
              </Link>
              <button
                type="button"
                className="organizer-event-library-icon-action is-danger"
                onClick={() => void handleDelete(event)}
                disabled={!canDelete || deletingId === event.id}
                title={
                  canDelete
                    ? t("organizer.deleteEvent")
                    : t("organizerEvents.cannotDeleteSold")
                }
                aria-label={t("organizerEvents.deleteEventAria", { title: event.title })}
              >
                {deletingId === event.id ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <Trash2 size={16} />
                )}
              </button>
            </div>
          );
        },
      },
    ],
    [deletingId, handleDelete, handlePublish, language, publishingId, t],
  );

  const eventTable = useReactTable({
    data: displayedEvents,
    columns: eventColumns,
    state: { sorting },
    onSortingChange: setSorting,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <OrganizerLayout
      title={t("organizerEvents.title")}
      description={t("organizerEvents.description")}
      actions={null}
      className="organizer-events-page"
    >
      <section className="organizer-events-analytics">
        <div className="organizer-events-stat-grid">
          <article className="organizer-hub-kpi-card">
            <span className="organizer-hub-kpi-icon organizer-events-stat-icon-total">
              <FaCalendarCheck size={36} />
            </span>
            <div>
              <span>{t("organizerProfile.totalEvents")}</span>
              <strong>{numberFormat(analytics.totalEvents, language)}</strong>
              <small>{t("organizerEvents.totalEventsDescription")}</small>
            </div>
          </article>
          <article className="organizer-hub-kpi-card">
            <span className="organizer-hub-kpi-icon organizer-events-stat-icon-published">
              <HiBadgeCheck size={36} />
            </span>
            <div>
              <span>{t("status.published")}</span>
              <strong>{numberFormat(analytics.publishedCount, language)}</strong>
              <small>{t("organizerEvents.publishedDescription")}</small>
            </div>
          </article>
          <article className="organizer-hub-kpi-card">
            <span className="organizer-hub-kpi-icon organizer-events-stat-icon-draft">
              <FaFileSignature size={36} />
            </span>
            <div>
              <span>{t("status.draft")}</span>
              <strong>{numberFormat(analytics.draftCount, language)}</strong>
              <small>{t("organizerEvents.draftDescription")}</small>
            </div>
          </article>
          <article className="organizer-hub-kpi-card">
            <span className="organizer-hub-kpi-icon organizer-events-stat-icon-tickets">
              <HiTicket size={36} />
            </span>
            <div>
              <span>{t("publicOrganizer.ticketsSold")}</span>
              <strong>{numberFormat(analytics.totalTicketsSold, language)}</strong>
              <small>{t("organizerEvents.ticketsSoldDescription")}</small>
            </div>
          </article>
        </div>

        {analyticsLoading ? (
          <section className="organizer-panel organizer-empty-state">
            <div className="loading-spinner" />
            <p>{t("organizerEvents.timelineLoading")}</p>
          </section>
        ) : (
          <article className="organizer-panel organizer-events-timeline-card">
            <div className="organizer-events-timeline-heading">
              <div>
                <p className="organizer-dashboard-chart-title">{t("organizerEvents.timelineTitle")}</p>
                <span>{t("organizerEvents.timelineDescription")}</span>
              </div>
            </div>
            {analytics.timelineItems.length > 0 ? (
              <Chart
                options={timelineChartOptions}
                series={timelineSeries}
                type="area"
                height={300}
              />
            ) : (
              <div className="organizer-dashboard-empty-chart">
                {t("organizerEvents.emptyTimeline")}
              </div>
            )}
          </article>
        )}
      </section>

      {loading || searching ? (
        <section className="organizer-panel organizer-empty-state">
          <div className="loading-spinner" />
          <p>
            {searching ? t("organizerEvents.searching") : t("organizerEvents.listLoading")}
          </p>
        </section>
      ) : (
        <section className="organizer-panel organizer-events-library-panel">
          <div className="organizer-panel-heading-row organizer-events-list-heading">
            <div>
              <p className="organizer-dashboard-chart-title">{t("organizerEvents.listTitle")}</p>
            </div>
            <div className="organizer-events-list-actions">
              <form className="organizer-events-list-search" onSubmit={handleSearch}>
                <input
                  value={keywordInput}
                  onChange={(event) => setKeywordInput(event.target.value)}
                  className="organizer-events-list-search-input"
                  placeholder={t("organizerEvents.searchPlaceholder")}
                />
                <button
                  type="submit"
                  className="organizer-events-list-search-button"
                  disabled={loading || searching}
                  aria-label={t("organizerEvents.searchAria")}
                >
                  <Search size={14} />
                </button>
              </form>
              <Link to="/organizer/events/new" className="organizer-events-add-button">
                {t("organizerEvents.addEvent")}
              </Link>
            </div>
          </div>

          <div className="organizer-events-list-filter-row organizer-events-library-filters">
            {eventListFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={`organizer-events-filter-pill ${
                  eventListFilter === filter.value ? "is-active" : ""
                }`}
                onClick={() => {
                  setEventListFilter(filter.value);
                  setCurrentPage(0);
                }}
              >
                {t(filter.label)} {numberFormat(eventFilterCounts[filter.value], language)}
              </button>
            ))}
          </div>

          {displayedEvents.length === 0 ? (
            <div className="organizer-event-library-empty">
              <Ticket size={28} />
              <p>
                {pageData?.content?.length || allEvents.length
                  ? t("organizerEvents.emptyFilter")
                  : t("organizerEvents.emptyList")}
              </p>
            </div>
          ) : (
            <div className="organizer-event-library-table">
              {eventTable.getHeaderGroups().map((headerGroup) => (
                <div
                  className="organizer-event-library-head"
                  key={headerGroup.id}
                >
                  {headerGroup.headers.map((header) => (
                    <span key={header.id}>
                      {header.column.getCanSort() ? (
                        <span className="organizer-event-library-sort-header">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          <button
                            type="button"
                            className="organizer-event-library-sort-button"
                            onClick={header.column.getToggleSortingHandler()}
                            aria-label={`${flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )} sort`}
                          >
                            {{
                              asc: "↑",
                              desc: "↓",
                            }[header.column.getIsSorted() as string] ?? "↓"}
                          </button>
                        </span>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </span>
                  ))}
                </div>
              ))}
              {eventTable.getRowModel().rows.map((row) => (
                <article className="organizer-event-library-row" key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <div key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </article>
              ))}
            </div>
          )}

          {displayedEvents.length > 0 ? (
            <AppPagination
              currentPage={currentPage}
              pageCount={pageCount}
              onPageChange={setCurrentPage}
              pageRangeDisplayed={4}
              marginPagesDisplayed={1}
              showPageInfo={false}
            />
          ) : null}
        </section>
      )}

      <Lightbox
        open={lightboxIndex >= 0}
        close={() => {
          setLightboxIndex(-1);
          setLightboxSlides([]);
        }}
        index={lightboxIndex >= 0 ? lightboxIndex : 0}
        slides={lightboxSlides}
      />
    </OrganizerLayout>
  );
}
