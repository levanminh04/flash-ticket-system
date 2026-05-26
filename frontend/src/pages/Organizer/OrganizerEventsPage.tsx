import { FormEvent, useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import { Link } from "react-router-dom";
import { LoaderCircle, Edit, Search, Ticket, Trash2 } from "lucide-react";
import { ApexOptions } from "apexcharts";
import { FaCalendarCheck, FaFileSignature } from "react-icons/fa6";
import { HiBadgeCheck } from "react-icons/hi";
import { HiTicket } from "react-icons/hi2";
import { toast } from "react-toastify";
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
  getEventTicketsSold,
} from "./organizerWorkspaceUtils";
import { useOrganizerGate } from "./useOrganizerGate";

const PAGE_SIZE = 10;
const ANALYTICS_PAGE_SIZE = 100;

type RevenueRange = "week" | "month" | "year";
type EventListFilter = "all" | "active" | "draft";

const revenueRangeOptions: Array<{ value: RevenueRange; label: string }> = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
];

const eventListFilters: Array<{ value: EventListFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
];

const categoryChartColors = [
  "#8B5CF6",
  "#F59E0B",
  "#EC4899",
  "#3B82F6",
  "#06B6D4",
  "#10B981",
  "#CC9900",
  "#64748B",
];

function numberFormat(value: number | null | undefined): string {
  return Number(value ?? 0).toLocaleString("vi-VN");
}

function currencyFormat(value: number): string {
  return `${Math.round(value).toLocaleString("vi-VN")} đ`;
}

function getEventStartTime(event: OrganizerEventDetail): number {
  const value = event.schedule?.startDatetime;
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function isEventInRevenueRange(
  event: OrganizerEventDetail,
  range: RevenueRange,
): boolean {
  const time = getEventStartTime(event);
  if (time <= 0) return false;

  const eventDate = new Date(time);
  const now = new Date();

  if (range === "week") {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    return eventDate >= weekAgo && eventDate <= now;
  }

  if (range === "month") {
    return (
      eventDate.getFullYear() === now.getFullYear() &&
      eventDate.getMonth() === now.getMonth()
    );
  }

  return eventDate.getFullYear() === now.getFullYear();
}

function getMonthLabel(time: number): string {
  const date = new Date(time);
  return String(date.getMonth() + 1).padStart(2, "0");
}

async function getAllOrganizerEvents(): Promise<OrganizerEventDetail[]> {
  const firstPage = await organizerWorkspaceService.getMyEvents(
    0,
    ANALYTICS_PAGE_SIZE,
  );
  const firstPageEvents = firstPage.content ?? [];

  if (firstPage.totalPages <= 1) return firstPageEvents;

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      organizerWorkspaceService.getMyEvents(index + 1, ANALYTICS_PAGE_SIZE),
    ),
  );

  return [
    ...firstPageEvents,
    ...remainingPages.flatMap((page) => page.content ?? []),
  ];
}

function pickEventCover(event: OrganizerEventDetail) {
  return (
    event.images?.find((image) => image.type === "BANNER")?.url ||
    event.images?.find((image) => image.type === "POSTER")?.url ||
    event.images?.find((image) => image.type === "THUMBNAIL")?.url ||
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
    ];

    return values.some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(normalizedKeyword),
    );
  });
}

function getVenueLabel(event: OrganizerEventDetail) {
  if (event.isOnline) return "Sự kiện online";
  const parts = [
    event.venue?.name,
    event.venue?.address,
    event.venue?.city,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Chưa chọn địa điểm";
}

function getTicketTypeLabel(event: OrganizerEventDetail) {
  if (!event.ticketTypes || event.ticketTypes.length === 0)
    return "Chưa có loại vé";
  return event.ticketTypes.map((ticketType) => ticketType.name).join(", ");
}

export default function OrganizerEventsPage() {
  const { ready } = useOrganizerGate();
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
  const [revenueRange, setRevenueRange] = useState<RevenueRange>("year");
  const [eventListFilter, setEventListFilter] =
    useState<EventListFilter>("all");

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
        );
        if (!cancelled) {
          setPageData(data);
        }
      } catch {
        if (!cancelled) {
          toast.error("Không thể tải danh sách sự kiện của organizer.");
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
  }, [ready, currentPage, searchResults]);

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
          toast.error("Không thể tải dữ liệu biểu đồ sự kiện.");
        }
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    };

    void loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [ready]);

  const baseEvents =
    searchResults ??
    (eventListFilter === "all" ? pageData?.content : allEvents) ??
    [];
  const filteredEvents = useMemo(() => {
    if (eventListFilter === "all") return baseEvents;
    const expectedStatus = eventListFilter === "active" ? "PUBLISHED" : "DRAFT";
    return baseEvents.filter((event) => event.status === expectedStatus);
  }, [baseEvents, eventListFilter]);
  const pageCount = searchResults || eventListFilter !== "all"
    ? Math.ceil(filteredEvents.length / PAGE_SIZE)
    : (pageData?.totalPages ?? 0);
  const displayedEvents = searchResults || eventListFilter !== "all"
    ? filteredEvents.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
    : filteredEvents;
  const eventFilterCounts = useMemo(() => {
    const source = searchResults ?? allEvents;
    return {
      all: source.length || pageData?.totalElements || baseEvents.length,
      active: source.filter((event) => event.status === "PUBLISHED").length,
      draft: source.filter((event) => event.status === "DRAFT").length,
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

    const categoryItems = [...allEvents.reduce((map, event) => {
      const categories = event.categories ?? [];
      if (categories.length === 0) {
        map.set("Chưa phân loại", (map.get("Chưa phân loại") ?? 0) + 1);
        return map;
      }
      categories.forEach((category) => {
        const label = category.name || "Chưa phân loại";
        map.set(label, (map.get(label) ?? 0) + 1);
      });
      return map;
    }, new Map<string, number>())]
      .map(([label, count], index) => ({
        label,
        count,
        color: categoryChartColors[index % categoryChartColors.length],
      }))
      .sort((a, b) => b.count - a.count);

    const topTicketEvents = [...allEvents]
      .sort((a, b) => getEventTicketsSold(b) - getEventTicketsSold(a))
      .slice(0, 5);

    const timelineItems = [...allEvents.reduce((map, event) => {
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
    }, new Map<string, { count: number; label: string; time: number }>()).values()]
      .sort((a, b) => a.time - b.time);

    const topRevenueEvents = [...allEvents]
      .map((event) => ({ event, revenue: getEventEstimatedRevenue(event) }))
      .filter((item) => item.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      totalEvents,
      publishedCount,
      draftCount,
      totalTicketsSold,
      categoryItems,
      topTicketEvents,
      timelineItems,
      topRevenueEvents,
    };
  }, [allEvents]);

  const filteredTopRevenueEvents = useMemo(
    () =>
      allEvents
        .filter((event) => isEventInRevenueRange(event, revenueRange))
        .map((event) => ({ event, revenue: getEventEstimatedRevenue(event) }))
        .filter((item) => item.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
    [allEvents, revenueRange],
  );



  const timelineChartOptions = useMemo<ApexOptions>(
    () => ({
      chart: { type: "line", toolbar: { show: false }, fontFamily: "Inter, system-ui, sans-serif" },
      colors: ["#3B82F6"],
      stroke: { width: 3, curve: "smooth" },
      markers: { size: 4, strokeWidth: 2, hover: { size: 6 } },
      dataLabels: { enabled: false },
      xaxis: {
        categories: analytics.timelineItems.map((item) => item.label),
        labels: { style: { colors: "#64748b", fontWeight: 600 } },
      },
      yaxis: {
        labels: {
          style: { colors: "#334155", fontWeight: 600 },
          formatter: (value) => numberFormat(value),
        },
      },
      grid: { borderColor: "#e2e8f0", strokeDashArray: 4 },
      tooltip: { y: { formatter: (value) => `${numberFormat(value)} sự kiện` } },
    }),
    [analytics.timelineItems],
  );

  const revenueChartOptions = useMemo<ApexOptions>(
    () => ({
      chart: { type: "bar", toolbar: { show: false }, fontFamily: "Inter, system-ui, sans-serif" },
      colors: ["#10B981"],
      plotOptions: { bar: { horizontal: false, borderRadius: 6, columnWidth: "48%" } },
      dataLabels: { enabled: false },
      grid: { borderColor: "#e2e8f0", strokeDashArray: 4 },
      xaxis: {
        categories: filteredTopRevenueEvents.map(({ event }) => event.title),
        labels: {
          rotate: -45,
          rotateAlways: true,
          hideOverlappingLabels: false,
          trim: true,
          maxHeight: 130,
          style: { colors: "#64748b", fontWeight: 600 },
        },
      },
      yaxis: {
        labels: {
          style: { colors: "#334155", fontWeight: 600 },
          formatter: (value) => currencyFormat(value),
        },
      },
      tooltip: { y: { formatter: (value) => currencyFormat(value) } },
    }),
    [filteredTopRevenueEvents],
  );

  const timelineSeries = useMemo(
    () => [
      {
        name: "Số sự kiện",
        data: analytics.timelineItems.map((item) => item.count),
      },
    ],
    [analytics.timelineItems],
  );
  const revenueSeries = useMemo(
    () => [
      {
        name: "Doanh thu ước tính",
        data: filteredTopRevenueEvents.map((item) => item.revenue),
      },
    ],
    [filteredTopRevenueEvents],
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
      );
      setSearchResults(filterEvents(allEventsPage.content, nextKeyword));
      setCurrentPage(0);
    } catch {
      toast.error("Không thể tìm kiếm sự kiện lúc này.");
    } finally {
      setSearching(false);
    }
  };

  const handleDelete = async (event: OrganizerEventDetail) => {
    const confirmed = await confirmDestructiveAction({
      title: "Xóa sự kiện này?",
      text: "Sự kiện sẽ bị xóa khỏi workspace organizer và thao tác này không thể hoàn tác.",
      confirmButtonText: "Xóa sự kiện",
      cancelButtonText: "Giữ lại",
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
      setSearchResults((current) =>
        current ? current.filter((item) => item.id !== event.id) : current,
      );
      toast.success("Đã xóa sự kiện.");
    } catch {
      toast.error("Không thể xóa sự kiện lúc này.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <OrganizerLayout
      title="Quản lý sự kiện"
      description="Danh sách và thông tin các sự kiện."
      actions={null}
    >
      <section className="organizer-events-analytics">
        <div className="organizer-events-stat-grid">
          <article className="organizer-events-stat-card">
            <FaCalendarCheck className="organizer-events-stat-icon-total" size={30} />
            <div className="organizer-events-stat-copy">
              <span>Tổng sự kiện</span>
              <strong>{numberFormat(analytics.totalEvents)}</strong>
            </div>
          </article>
          <article className="organizer-events-stat-card">
            <HiBadgeCheck className="organizer-events-stat-icon-published" size={30} />
            <div className="organizer-events-stat-copy">
              <span>Đã công bố</span>
              <strong>{numberFormat(analytics.publishedCount)}</strong>
            </div>
          </article>
          <article className="organizer-events-stat-card">
            <FaFileSignature className="organizer-events-stat-icon-draft" size={30} />
            <div className="organizer-events-stat-copy">
              <span>Bản nháp</span>
              <strong>{numberFormat(analytics.draftCount)}</strong>
            </div>
          </article>
          <article className="organizer-events-stat-card">
            <HiTicket className="organizer-events-stat-icon-tickets" size={30} />
            <div className="organizer-events-stat-copy">
              <span>Tổng vé đã bán</span>
              <strong>{numberFormat(analytics.totalTicketsSold)}</strong>
            </div>
          </article>
        </div>

        {analyticsLoading ? (
          <section className="organizer-panel organizer-empty-state">
            <div className="loading-spinner" />
            <p>Đang tải dữ liệu biểu đồ...</p>
          </section>
        ) : (
          <>
            <section className="organizer-events-chart-grid">
              <article className="organizer-panel organizer-events-chart-card">
                <p className="organizer-dashboard-chart-title">Timeline sự kiện theo tháng</p>
                {analytics.timelineItems.length > 0 ? (
                  <Chart
                    options={timelineChartOptions}
                    series={timelineSeries}
                    type="line"
                    height={320}
                  />
                ) : (
                  <div className="organizer-dashboard-empty-chart">Chưa có dữ liệu lịch sự kiện.</div>
                )}
              </article>

              <article className="organizer-panel organizer-events-chart-card">
                <div className="organizer-panel-heading-row organizer-events-chart-heading">
                  <p className="organizer-dashboard-chart-title">
                    Doanh thu ước tính theo sự kiện
                  </p>
                  <div
                    className="organizer-dashboard-time-tabs"
                    aria-label="Chọn khoảng thời gian doanh thu"
                  >
                    {revenueRangeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={revenueRange === option.value ? "is-active" : ""}
                        onClick={() => setRevenueRange(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                {filteredTopRevenueEvents.length > 0 ? (
                  <Chart
                    options={revenueChartOptions}
                    series={revenueSeries}
                    type="bar"
                    height={360}
                  />
                ) : (
                  <div className="organizer-dashboard-empty-chart">
                    Chưa có dữ liệu doanh thu.
                  </div>
                )}
              </article>
            </section>


          </>
        )}
      </section>

      {loading || searching ? (
        <section className="organizer-panel organizer-empty-state">
          <div className="loading-spinner" />
          <p>
            {searching ? "Đang tìm kiếm sự kiện..." : "Đang tải danh sách sự kiện..."}
          </p>
        </section>
      ) : displayedEvents.length === 0 ? (
        <section className="organizer-panel organizer-empty-state">
          <Ticket size={28} />
          <p>
            {pageData?.content?.length
              ? "Không có sự kiện nào khớp với điều kiện tìm kiếm hiện tại."
              : "Organizer này chưa có sự kiện nào."}
          </p>
        </section>
      ) : (
        <section className="organizer-panel">
          <div className="organizer-panel-heading-row organizer-events-list-heading">
            <div className="organizer-events-list-filter-row">
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
                  {filter.label} {numberFormat(eventFilterCounts[filter.value])}
                </button>
              ))}
            </div>
            <div className="organizer-events-list-actions">
              <form className="organizer-events-list-search" onSubmit={handleSearch}>
                <input
                  value={keywordInput}
                  onChange={(event) => setKeywordInput(event.target.value)}
                  className="organizer-events-list-search-input"
                  placeholder="Search.."
                />
                <button
                  type="submit"
                  className="organizer-events-list-search-button"
                  disabled={loading || searching}
                  aria-label="Tìm kiếm sự kiện"
                >
                  <Search size={14} />
                </button>
              </form>
              <Link to="/organizer/events/new" className="organizer-events-add-button">
                Thêm sự kiện
              </Link>
            </div>
          </div>
          <div className="organizer-media-table-wrap organizer-event-table-wrap">
            <table className="organizer-event-table organizer-events-page-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Banner</th>
                  <th>Tên sự kiện</th>
                  <th>Bắt đầu</th>
                  <th>Kết thúc</th>
                  <th>Địa điểm</th>
                  <th>Loại vé</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {displayedEvents.map((event, index) => {
                  const coverUrl = pickEventCover(event);

                  return (
                    <tr key={event.id}>
                      <td>{currentPage * PAGE_SIZE + index + 1}</td>
                      <td>
                        {coverUrl ? (
                          <button
                            type="button"
                            className="organizer-media-thumb organizer-media-thumb-trigger"
                            onClick={() => {
                              setLightboxSlides([
                                { src: coverUrl, alt: event.title },
                              ]);
                              setLightboxIndex(0);
                            }}
                            aria-label={`Xem banner của ${event.title}`}
                            title="Xem ảnh lớn"
                          >
                            <img src={coverUrl} alt={event.title} />
                          </button>
                        ) : (
                          <div className="organizer-media-thumb organizer-event-thumb-placeholder">
                            <span>Không có</span>
                          </div>
                        )}
                      </td>
                      <td
                        className="organizer-event-title-cell"
                        title={event.title}
                      >
                        {" "}
                        {event.title}
                      </td>
                      <td>{formatDateTime(event.schedule?.startDatetime)}</td>
                      <td>{formatDateTime(event.schedule?.endDatetime)}</td>
                      <td
                        className="organizer-event-location-cell"
                        title={getVenueLabel(event)}
                      >
                        {getVenueLabel(event)}
                      </td>
                      <td
                        className="organizer-event-ticket-types-cell"
                        title={getTicketTypeLabel(event)}
                      >
                        {getTicketTypeLabel(event)}
                      </td>
                      <td className="organizer-media-action-cell">
                        <div className="organizer-media-actions">
                          <Link
                            to={`/organizer/events/${event.id}/edit`}
                            className="organizer-icon-action organizer-icon-action-info"
                            aria-label={`Chỉnh sửa ${event.title}`}
                            title="Chỉnh sửa"
                          >
                            <Edit size={16} />
                          </Link>
                          <button
                            type="button"
                            className="organizer-icon-action organizer-icon-action-danger"
                            onClick={() => void handleDelete(event)}
                            disabled={deletingId === event.id}
                            aria-label={`Xóa ${event.title}`}
                            title="Xóa sự kiện"
                          >
                            {deletingId === event.id ? (
                              <LoaderCircle size={16} className="spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <AppPagination
            currentPage={currentPage}
            pageCount={pageCount}
            onPageChange={setCurrentPage}
            pageRangeDisplayed={4}
            marginPagesDisplayed={1}
            showPageInfo={false}
          />
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


