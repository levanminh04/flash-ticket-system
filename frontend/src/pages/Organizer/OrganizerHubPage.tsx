import { useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import { AlertCircle } from "lucide-react";
import { ApexOptions } from "apexcharts";
import { FaCalendarAlt } from "react-icons/fa";
import { GiReceiveMoney } from "react-icons/gi";
import { HiMiniUserGroup, HiTicket } from "react-icons/hi2";
import { HiUserGroup } from "react-icons/hi";
import { RiDiscountPercentFill } from "react-icons/ri";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import {
  OrganizerEventDetail,
  organizerWorkspaceService,
} from "../../services/organizerWorkspaceService";
import {
  OrganizerProfile,
  organizerService,
} from "../../services/organizerService";
import { useOrganizerGate } from "./useOrganizerGate";

type EventStatusKey = "DRAFT" | "PUBLISHED" | "CANCELLED" | "SOLD_OUT" | "OTHER";
type RevenueRange = "30D" | "90D" | "ALL";

const ORGANIZER_EVENTS_PAGE_SIZE = 100;

const revenueRangeOptions: Array<{ label: string; value: RevenueRange }> = [
  { label: "30 ngày", value: "30D" },
  { label: "90 ngày", value: "90D" },
  { label: "Tất cả", value: "ALL" },
];

const eventStatusLabels: Record<EventStatusKey, string> = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã công bố",
  CANCELLED: "Đã hủy",
  SOLD_OUT: "Hết vé",
  OTHER: "Khác",
};

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

function percentFormat(value: number): string {
  return `${Math.round(value)}%`;
}

function currencyFormat(value: number): string {
  return `${Math.round(value).toLocaleString("vi-VN")} đ`;
}

function getEventStartTime(event: OrganizerEventDetail): number {
  const value = event.schedule?.startDatetime;
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function getStatusKey(status?: string): EventStatusKey {
  if (
    status === "DRAFT" ||
    status === "PUBLISHED" ||
    status === "CANCELLED" ||
    status === "SOLD_OUT"
  ) {
    return status;
  }
  return "OTHER";
}

function getEstimatedRevenue(event: OrganizerEventDetail): number {
  const ticketTypes = event.ticketTypes ?? [];
  return ticketTypes.reduce((sum, ticketType) => {
    const total = ticketType.quantityTotal ?? 0;
    const available = ticketType.quantityAvailable ?? total;
    const sold = Math.max(total - available, 0);
    return sum + sold * Number(ticketType.price ?? 0);
  }, 0);
}

function getEventThumbnail(event: OrganizerEventDetail): string {
  return (
    event.images?.find((image) => image.isPrimary)?.url ??
    event.images?.[0]?.url ??
    ""
  );
}

function getEventRevenueTime(event: OrganizerEventDetail): number {
  const value = event.createdAt ?? event.schedule?.startDatetime;
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getRevenueRangeStart(range: RevenueRange): number {
  if (range === "ALL") return 0;
  const days = range === "30D" ? 30 : 90;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function formatRevenueDateLabel(time: number): string {
  const date = new Date(time);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()}`;
}

async function getAllOrganizerEvents(): Promise<OrganizerEventDetail[]> {
  const firstPage = await organizerWorkspaceService.getMyEvents(
    0,
    ORGANIZER_EVENTS_PAGE_SIZE,
    "createdAt,desc",
  );
  const firstPageEvents = firstPage.content ?? [];

  if (firstPage.totalPages <= 1) {
    return firstPageEvents;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      organizerWorkspaceService.getMyEvents(
        index + 1,
        ORGANIZER_EVENTS_PAGE_SIZE,
        "createdAt,desc",
      ),
    ),
  );

  return [
    ...firstPageEvents,
    ...remainingPages.flatMap((page) => page.content ?? []),
  ];
}

export default function OrganizerHubPage() {
  const { ready } = useOrganizerGate();
  const [profile, setProfile] = useState<OrganizerProfile | null>(null);
  const [events, setEvents] = useState<OrganizerEventDetail[]>([]);
  const [revenueRange, setRevenueRange] = useState<RevenueRange>("90D");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const [profileData, allEvents] = await Promise.all([
          organizerService.getMyOrganizerProfile(),
          getAllOrganizerEvents(),
        ]);

        if (!cancelled) {
          setProfile(profileData);
          setEvents(allEvents);
        }
      } catch {
        if (!cancelled) {
          setError("Không thể tải dữ liệu tổng quan organizer.");
          setProfile(null);
          setEvents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [ready]);

  const dashboard = useMemo(() => {
    const totalEvents = events.length;
    const totalTicketsSold = events.reduce(
      (sum, event) => sum + (event.statistics?.ticketsSold ?? 0),
      0,
    );
    const totalCapacity = events.reduce(
      (sum, event) => sum + (event.statistics?.totalCapacity ?? 0),
      0,
    );
    const occupancyRate =
      totalCapacity > 0 ? Math.min((totalTicketsSold / totalCapacity) * 100, 100) : 0;
    const estimatedRevenue = events.reduce(
      (sum, event) => sum + getEstimatedRevenue(event),
      0,
    );

    const upcomingEvents = events
      .filter((event) => getEventStartTime(event) > Date.now())
      .sort((a, b) => getEventStartTime(a) - getEventStartTime(b))
      .slice(0, 5);

    const topEvents = [...events]
      .sort(
        (a, b) =>
          (b.statistics?.ticketsSold ?? 0) - (a.statistics?.ticketsSold ?? 0),
      )
      .slice(0, 5);
    return {
      totalEvents,
      totalTicketsSold,
      totalCapacity,
      occupancyRate,
      estimatedRevenue,
      upcomingEvents,
      topEvents,
    };
  }, [events, profile]);

  const revenueTimeline = useMemo(() => {
    const rangeStart = getRevenueRangeStart(revenueRange);
    const revenueByDate = new Map<string, { label: string; time: number; revenue: number }>();

    events.forEach((event) => {
      const time = getEventRevenueTime(event);
      const revenue = getEstimatedRevenue(event);
      if (time <= 0 || revenue <= 0 || time < rangeStart) return;

      const date = new Date(time);
      const key = date.toISOString().slice(0, 10);
      const existing = revenueByDate.get(key);

      if (existing) {
        existing.revenue += revenue;
      } else {
        revenueByDate.set(key, {
          label: formatRevenueDateLabel(time),
          time,
          revenue,
        });
      }
    });

    return [...revenueByDate.values()].sort((a, b) => a.time - b.time);
  }, [events, revenueRange]);

  const categoryChartItems = useMemo(
    () => {
      const categoryCounts = new Map<string, number>();

      events.forEach((event) => {
        const categories = event.categories ?? [];

        if (categories.length === 0) {
          categoryCounts.set(
            "Chưa phân loại",
            (categoryCounts.get("Chưa phân loại") ?? 0) + 1,
          );
          return;
        }

        categories.forEach((category) => {
          const label = category.name || "Chưa phân loại";
          categoryCounts.set(label, (categoryCounts.get(label) ?? 0) + 1);
        });
      });

      return [...categoryCounts.entries()]
        .map(([label, count], index) => ({
          label,
          count,
          color: categoryChartColors[index % categoryChartColors.length],
        }))
        .sort((a, b) => b.count - a.count);
    },
    [events],
  );

  const categorySeries = useMemo(
    () => categoryChartItems.map((item) => item.count),
    [categoryChartItems],
  );

  const categoryChartOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: "donut",
        toolbar: { show: false },
        fontFamily: "Inter, system-ui, sans-serif",
      },
      labels: categoryChartItems.map((item) => item.label),
      colors: categoryChartItems.map((item) => item.color),
      dataLabels: {
        enabled: true,
        formatter: (_value, opts) =>
          numberFormat(categoryChartItems[opts?.seriesIndex ?? 0]?.count ?? 0),
      },
      legend: {
        position: "right",
        horizontalAlign: "center",
        fontWeight: 600,
        labels: { colors: "#475569" },
        formatter: (seriesName, opts) =>
          `${seriesName}: ${numberFormat(
            categoryChartItems[opts?.seriesIndex ?? 0]?.count ?? 0,
          )}`,
      },
      stroke: { width: 0 },
      plotOptions: {
        pie: {
          donut: {
            size: "68%",
            labels: {
              show: true,
              total: {
                show: true,
                label: "Sự kiện",
                formatter: () => numberFormat(dashboard.totalEvents),
              },
            },
          },
        },
      },
      tooltip: {
        y: {
          formatter: (value) => `${numberFormat(value)} sự kiện`,
        },
      },
    }),
    [categoryChartItems, dashboard.totalEvents],
  );

  const topEventChartOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: "bar",
        toolbar: { show: false },
        fontFamily: "Inter, system-ui, sans-serif",
      },
      colors: ["#cc9900"],
      plotOptions: {
        bar: {
          borderRadius: 6,
          horizontal: false,
          columnWidth: "48%",
        },
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: dashboard.topEvents.map((event) => event.title),
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
          formatter: (value) => numberFormat(value),
        },
      },
      grid: {
        borderColor: "#e2e8f0",
        strokeDashArray: 4,
      },
      tooltip: {
        y: {
          formatter: (value) => `${numberFormat(value)} vé`,
        },
      },
    }),
    [dashboard.topEvents],
  );

  const topEventSeries = useMemo(
    () => [
      {
        name: "Vé đã bán",
        data: dashboard.topEvents.map((event) => event.statistics?.ticketsSold ?? 0),
      },
    ],
    [dashboard.topEvents],
  );

  const revenueChartOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: "line",
        toolbar: { show: false },
        fontFamily: "Inter, system-ui, sans-serif",
      },
      colors: ["#16a34a", "#cc9900"],
      stroke: {
        width: 3,
        curve: "smooth",
      },
      markers: {
        size: 4,
        strokeWidth: 2,
        hover: { size: 6 },
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: revenueTimeline.map((item) => item.label),
        labels: {
          style: { colors: "#64748b", fontWeight: 600 },
        },
      },
      yaxis: {
        labels: {
          style: { colors: "#334155", fontWeight: 600 },
          formatter: (value) => currencyFormat(value),
        },
      },
      grid: {
        borderColor: "#e2e8f0",
        strokeDashArray: 4,
      },
      tooltip: {
        y: {
          formatter: (value) => currencyFormat(value),
        },
      },
    }),
    [revenueTimeline],
  );

  const revenueSeries = useMemo(
    () => [
      {
        name: "Doanh thu ước tính",
        data: revenueTimeline.map((item) => item.revenue),
      },
    ],
    [revenueTimeline],
  );

  return (
    <OrganizerLayout
      title="Tổng quan"
      description="Theo dõi hiệu suất sự kiện, vé bán và các tác vụ vận hành chính của ban tổ chức."
    >
      {loading ? (
        <section className="organizer-panel organizer-dashboard-state">
          <div className="loading-spinner" />
          <p>Đang tải dữ liệu tổng quan</p>
        </section>
      ) : error ? (
        <section className="organizer-panel organizer-dashboard-state">
          <AlertCircle size={28} />
          <p>{error}</p>
        </section>
      ) : (
        <>
          <section className="organizer-dashboard-stats">
            <article className="organizer-dashboard-stat-card">
              <FaCalendarAlt className="organizer-dashboard-stat-icon-events" size={30} />
              <div className="organizer-dashboard-stat-copy">
                <span>Tổng sự kiện</span>
                <strong>{numberFormat(dashboard.totalEvents)}</strong>
              </div>
            </article>
            <article className="organizer-dashboard-stat-card">
              <HiTicket className="organizer-dashboard-stat-icon-tickets" size={30} />
              <div className="organizer-dashboard-stat-copy">
                <span>Vé đã bán</span>
                <strong>{numberFormat(dashboard.totalTicketsSold)}</strong>
              </div>
            </article>
            <article className="organizer-dashboard-stat-card">
              <RiDiscountPercentFill className="organizer-dashboard-stat-icon-occupancy" size={30} />
              <div className="organizer-dashboard-stat-copy">
                <span>Tỷ lệ lấp đầy</span>
                <strong>{percentFormat(dashboard.occupancyRate)}</strong>
              </div>
            </article>
            <article className="organizer-dashboard-stat-card">
              <HiMiniUserGroup className="organizer-dashboard-stat-icon-followers" size={30} />
              <div className="organizer-dashboard-stat-copy">
                <span>Người theo dõi</span>
                <strong>{numberFormat(profile?.followerCount)}</strong>
              </div>
            </article>
          </section>

          <section className="organizer-dashboard-grid">
            <article className="organizer-panel organizer-chart-panel">
              <div className="organizer-revenue-panel-heading">
                <div>
                  <p className="organizer-dashboard-chart-title">Biểu đồ doanh thu</p>
                </div>
                <div className="organizer-dashboard-time-tabs" aria-label="Khoảng thời gian doanh thu">
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
              {revenueTimeline.length > 0 ? (
                <Chart
                  options={revenueChartOptions}
                  series={revenueSeries}
                  type="line"
                  height={310}
                />
              ) : (
                <div className="organizer-dashboard-empty-chart">
                  Chưa có dữ liệu doanh thu.
                </div>
              )}
            </article>

            <article className="organizer-panel organizer-chart-panel">
              <div className="organizer-panel-heading-row">
                <div>
                  <p className="organizer-dashboard-chart-title">
                    Top 5 sự kiện bán chạy nhất
                  </p>
                </div>
              </div>
              {dashboard.topEvents.length > 0 ? (
                <Chart
                  options={topEventChartOptions}
                  series={topEventSeries}
                  type="bar"
                  height={310}
                />
              ) : (
                <div className="organizer-dashboard-empty-chart">
                  Chưa có dữ liệu vé bán.
                </div>
              )}
            </article>
          </section>

          <section className="organizer-dashboard-grid">
            <article className="organizer-panel organizer-dashboard-list-panel">
              <div className="organizer-panel-heading-row">
                <div>
                  <p className="organizer-dashboard-chart-title">Sắp diễn ra</p>
                </div>
              </div>
              <div className="organizer-dashboard-event-list">
                {dashboard.upcomingEvents.length > 0 ? (
                  dashboard.upcomingEvents.map((event) => {
                    const thumbnailUrl = getEventThumbnail(event);

                    return (
                      <div className="organizer-dashboard-event-row" key={event.id}>
                        <div className="organizer-dashboard-event-main">
                          {thumbnailUrl ? (
                            <img
                              src={thumbnailUrl}
                              alt={event.title}
                              className="organizer-dashboard-event-thumb"
                            />
                          ) : (
                            <div className="organizer-dashboard-event-thumb-placeholder">
                              {event.title.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="organizer-dashboard-event-copy">
                            <strong>{event.title}</strong>
                            <span className="organizer-dashboard-event-time">
                              <FaCalendarAlt size={13} />
                              {event.schedule?.startDatetime
                                ? new Date(event.schedule.startDatetime).toLocaleString(
                                    "vi-VN",
                                  )
                                : "Chưa có lịch"}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`organizer-tag organizer-dashboard-status-${getStatusKey(
                            event.status,
                          ).toLowerCase()}`}
                        >
                          {eventStatusLabels[getStatusKey(event.status)]}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="organizer-dashboard-empty-chart">
                    Chưa có sự kiện sắp diễn ra.
                  </div>
                )}
              </div>
            </article>

            <article className="organizer-panel organizer-dashboard-list-panel">
              <div className="organizer-panel-heading">
                <p className="organizer-dashboard-chart-title">Hiệu suất ước tính</p>
              </div>
              <div className="organizer-dashboard-category-chart">
                {categorySeries.length > 0 ? (
                  <Chart
                    options={categoryChartOptions}
                    series={categorySeries}
                    type="donut"
                    height={260}
                  />
                ) : (
                  <div className="organizer-dashboard-empty-chart">
                    Chưa có dữ liệu sự kiện.
                  </div>
                )}
              </div>
              <div className="organizer-dashboard-metrics">
                <div>
                  <HiUserGroup className="organizer-dashboard-metric-icon-capacity" size={30} />
                  <span>
                    <span className="organizer-dashboard-metric-label">
                      Sức chứa ghi nhận
                    </span>
                    <strong>{numberFormat(dashboard.totalCapacity)}</strong>
                  </span>
                </div>
                <div>
                  <GiReceiveMoney className="organizer-dashboard-metric-icon-revenue" size={30} />
                  <span>
                    <span className="organizer-dashboard-metric-label">
                      Doanh thu ước tính
                    </span>
                    <strong>{currencyFormat(dashboard.estimatedRevenue)}</strong>
                  </span>
                </div>
              </div>
            </article>
          </section>
        </>
      )}
    </OrganizerLayout>
  );
}
