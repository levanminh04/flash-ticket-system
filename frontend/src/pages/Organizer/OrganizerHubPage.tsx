import { useEffect, useMemo, useState } from "react";
import Chart from "react-apexcharts";
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpRight } from "lucide-react";
import { FaCalendarAlt, FaCheckCircle } from "react-icons/fa";
import { IoTicketSharp } from "react-icons/io5";
import { HiUserGroup } from "react-icons/hi2";
import { ApexOptions } from "apexcharts";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import {
  OrganizerEventDetail,
  organizerWorkspaceService,
} from "../../services/organizerWorkspaceService";
import {
  OrganizerProfile,
  organizerService,
} from "../../services/organizerService";
import {
  getEventEstimatedRevenue,
  getEventTicketCapacity,
  getEventTicketsSold,
} from "./organizerWorkspaceUtils";
import { useOrganizerGate } from "./useOrganizerGate";

type EventStatusKey = "DRAFT" | "PUBLISHED" | "CANCELLED" | "SOLD_OUT" | "OTHER";

const ORGANIZER_EVENTS_PAGE_SIZE = 100;

type DashboardTrend = {
  value: number;
  direction: "up" | "down";
  sparkline: number[];
};

type TopEventRange = "week" | "month" | "year";

const topEventRangeOptions: Array<{ value: TopEventRange; label: string }> = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
];

const eventStatusLabels: Record<EventStatusKey, string> = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã công bố",
  CANCELLED: "Đã hủy",
  SOLD_OUT: "Hết vé",
  OTHER: "Khác",
};



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

function getEventYear(event: OrganizerEventDetail): number | null {
  const time = getEventStartTime(event);
  if (!Number.isFinite(time)) return null;
  return new Date(time).getFullYear();
}

function isEventInTopRange(
  event: OrganizerEventDetail,
  range: TopEventRange,
): boolean {
  const time = getEventStartTime(event);
  if (!Number.isFinite(time)) return false;

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

function calculateTrend(
  current: number,
  previous: number,
  sparkline: number[],
): DashboardTrend {
  if (previous <= 0) {
    return {
      value: current > 0 ? 100 : 0,
      direction: "up",
      sparkline,
    };
  }

  const change = ((current - previous) / previous) * 100;
  return {
    value: Math.abs(change),
    direction: change >= 0 ? "up" : "down",
    sparkline,
  };
}

function buildMonthlySeries(
  events: OrganizerEventDetail[],
  selector: (events: OrganizerEventDetail[]) => number,
): number[] {
  const currentYear = new Date().getFullYear();

  return Array.from({ length: 12 }, (_, monthIndex) =>
    selector(
      events.filter((event) => {
        const time = getEventStartTime(event);
        if (!Number.isFinite(time)) return false;
        const date = new Date(time);
        return date.getFullYear() === currentYear && date.getMonth() === monthIndex;
      }),
    ),
  );
}

function DashboardStatCard({
  icon,
  label,
  value,
  trend,
}: {
  icon: JSX.Element;
  label: string;
  value: string;
  trend: DashboardTrend;
}) {
  const isUp = trend.direction === "up";
  const ArrowIcon = isUp ? ArrowUp : ArrowDown;
  const trendColor = isUp ? "#16a34a" : "#dc2626";
  const sparklineOptions: ApexOptions = {
    chart: {
      type: "line",
      sparkline: { enabled: true },
      animations: { enabled: false },
      toolbar: { show: false },
    },
    colors: [trendColor],
    stroke: {
      width: 3,
      curve: "smooth",
      lineCap: "round",
    },
    tooltip: { enabled: false },
    grid: { show: false },
    xaxis: { labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { show: false },
  };

  return (
    <article className="organizer-dashboard-stat-card">
      <div className="organizer-dashboard-stat-top">
        <div className="organizer-dashboard-stat-heading">
          <span className="organizer-dashboard-stat-icon-wrap">{icon}</span>
          <span>{label}</span>
        </div>
        <span className="organizer-dashboard-stat-open-icon">
          <ArrowUpRight size={18} />
        </span>
      </div>

      <div className="organizer-dashboard-stat-bottom">
        <div className="organizer-dashboard-stat-copy">
          <strong>{value}</strong>
          <div
            className={`organizer-dashboard-stat-trend ${
              isUp ? "is-up" : "is-down"
            }`}
          >
            <ArrowIcon size={14} />
            <span>{percentFormat(trend.value)}</span>
            <small>This Year</small>
          </div>
        </div>
        <div className="organizer-dashboard-stat-line-chart">
          <Chart
            options={sparklineOptions}
            series={[{ name: label, data: trend.sparkline }]}
            type="line"
            height={64}
            width="100%"
          />
        </div>
      </div>
    </article>
  );
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topEventRange, setTopEventRange] = useState<TopEventRange>("year");

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
      (sum, event) => sum + getEventTicketsSold(event),
      0,
    );
    const totalCapacity = events.reduce(
      (sum, event) => sum + getEventTicketCapacity(event),
      0,
    );
    const occupancyRate =
      totalCapacity > 0 ? Math.min((totalTicketsSold / totalCapacity) * 100, 100) : 0;
    const estimatedRevenue = events.reduce(
      (sum, event) => sum + getEventEstimatedRevenue(event),
      0,
    );
    const currentYear = new Date().getFullYear();
    const currentYearEvents = events.filter(
      (event) => getEventYear(event) === currentYear,
    );
    const previousYearEvents = events.filter(
      (event) => getEventYear(event) === currentYear - 1,
    );
    const currentYearTicketsSold = currentYearEvents.reduce(
      (sum, event) => sum + getEventTicketsSold(event),
      0,
    );
    const previousYearTicketsSold = previousYearEvents.reduce(
      (sum, event) => sum + getEventTicketsSold(event),
      0,
    );
    const currentYearCapacity = currentYearEvents.reduce(
      (sum, event) => sum + getEventTicketCapacity(event),
      0,
    );
    const previousYearCapacity = previousYearEvents.reduce(
      (sum, event) => sum + getEventTicketCapacity(event),
      0,
    );
    const currentYearOccupancyRate =
      currentYearCapacity > 0
        ? Math.min((currentYearTicketsSold / currentYearCapacity) * 100, 100)
        : 0;
    const previousYearOccupancyRate =
      previousYearCapacity > 0
        ? Math.min((previousYearTicketsSold / previousYearCapacity) * 100, 100)
        : 0;
    const eventSparkline = buildMonthlySeries(
      events,
      (monthlyEvents) => monthlyEvents.length,
    );
    const ticketSparkline = buildMonthlySeries(
      events,
      (monthlyEvents) =>
        monthlyEvents.reduce(
          (sum, event) => sum + getEventTicketsSold(event),
          0,
        ),
    );
    const occupancySparkline = buildMonthlySeries(events, (monthlyEvents) => {
      const monthlyTicketsSold = monthlyEvents.reduce(
        (sum, event) => sum + getEventTicketsSold(event),
        0,
      );
      const monthlyCapacity = monthlyEvents.reduce(
        (sum, event) => sum + getEventTicketCapacity(event),
        0,
      );
      return monthlyCapacity > 0
        ? Math.min((monthlyTicketsSold / monthlyCapacity) * 100, 100)
        : 0;
    });
    const followerSparkline = Array.from(
      { length: 12 },
      () => profile?.followerCount ?? 0,
    );

    const statusCounts = events.reduce<Record<EventStatusKey, number>>(
      (counts, event) => {
        const key = getStatusKey(event.status);
        counts[key] += 1;
        return counts;
      },
      { DRAFT: 0, PUBLISHED: 0, CANCELLED: 0, SOLD_OUT: 0, OTHER: 0 },
    );

    const upcomingEvents = events
      .filter((event) => getEventStartTime(event) > Date.now())
      .sort((a, b) => getEventStartTime(a) - getEventStartTime(b))
      .slice(0, 3);

    return {
      totalEvents,
      totalTicketsSold,
      totalCapacity,
      occupancyRate,
      estimatedRevenue,
      trends: {
        totalEvents: calculateTrend(
          currentYearEvents.length,
          previousYearEvents.length,
          eventSparkline,
        ),
        totalTicketsSold: calculateTrend(
          currentYearTicketsSold,
          previousYearTicketsSold,
          ticketSparkline,
        ),
        occupancyRate: calculateTrend(
          currentYearOccupancyRate,
          previousYearOccupancyRate,
          occupancySparkline,
        ),
        followerCount: calculateTrend(
          profile?.followerCount ?? 0,
          0,
          followerSparkline,
        ),
      },
      statusCounts,
      upcomingEvents,
    };
  }, [events, profile]);

  const topEvents = useMemo(
    () =>
      events
        .filter((event) => isEventInTopRange(event, topEventRange))
        .sort((a, b) => getEventTicketsSold(b) - getEventTicketsSold(a))
        .slice(0, 5),
    [events, topEventRange],
  );

  const categoryChartItems = useMemo(() => {
    const categoryChartColors = [
      "#8B5CF6",
      "#F59E0B",
      "#EC4899",
      "#3B82F6",
      "#06B6D4",
      "#10B981",
      "#CC9900",
      "#64748b",
    ];

    const categoryMap = events.reduce((map, event) => {
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
    }, new Map<string, number>());

    return [...categoryMap.entries()]
      .map(([label, count], index) => ({
        label,
        count,
        color: categoryChartColors[index % categoryChartColors.length],
      }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

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
      dataLabels: { enabled: false },
      legend: {
        position: "bottom",
        fontWeight: 600,
        labels: { colors: "#475569" },
      },
      stroke: { width: 0 },
      plotOptions: {
        pie: {
          customScale: 0.8,
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
    [dashboard.totalEvents, categoryChartItems],
  );

  const topEventChartOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: "bar",
        toolbar: { show: false },
        fontFamily: "Inter, system-ui, sans-serif",
      },
      colors: ["#10B981"],
      plotOptions: {
        bar: {
          borderRadius: 6,
          horizontal: false,
          columnWidth: "48%",
        },
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: topEvents.map((event) => event.title),
        labels: {
          rotate: -45,
          rotateAlways: true,
          hideOverlappingLabels: false,
          trim: true,
          maxHeight: 120,
          style: { colors: "#334155", fontWeight: 600 },
        },
      },
      yaxis: {
        labels: {
          style: { colors: "#64748b", fontWeight: 600 },
          formatter: (value) => numberFormat(Number(value)),
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
    [topEvents],
  );

  const topEventSeries = useMemo(
    () => [
      {
        name: "Vé đã bán",
        data: topEvents.map((event) => getEventTicketsSold(event)),
      },
    ],
    [topEvents],
  );

  const performanceChartOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: "radialBar",
        toolbar: { show: false },
        fontFamily: "Inter, system-ui, sans-serif",
      },
      plotOptions: {
        radialBar: {
          startAngle: -110,
          endAngle: 110,
          hollow: {
            size: "68%",
          },
          track: {
            background: "#f1f5f9",
            strokeWidth: "97%",
          },
          dataLabels: {
            name: {
              show: true,
              fontSize: "13px",
              fontWeight: 600,
              color: "#64748b",
              offsetY: -8,
            },
            value: {
              show: true,
              fontSize: "24px",
              fontWeight: 700,
              color: "#0f172a",
              offsetY: 4,
              formatter: (val) => `${Math.round(Number(val))}%`,
            },
          },
        },
      },
      fill: {
        type: "gradient",
        gradient: {
          shade: "dark",
          type: "horizontal",
          shadeIntensity: 0.5,
          gradientToColors: ["#059669"],
          inverseColors: true,
          opacityFrom: 1,
          opacityTo: 1,
          stops: [0, 100],
        },
      },
      colors: ["#10B981"],
      stroke: {
        dashArray: 3,
      },
      labels: ["Tỷ lệ lấp đầy"],
    }),
    [],
  );

  const performanceSeries = useMemo(
    () => [dashboard.occupancyRate],
    [dashboard.occupancyRate],
  );

  return (
    <OrganizerLayout
      title="Tổng quan"
      description="Theo dõi hiệu suất sự kiện và vé bán."
      className="organizer-hub-page"
    >
      {loading ? (
        <section className="organizer-panel organizer-empty-state">
          <div className="loading-spinner" />
          <p>Đang tải dữ liệu tổng quan...</p>
        </section>
      ) : error ? (
        <section className="organizer-panel organizer-dashboard-state">
          <AlertCircle size={28} />
          <p>{error}</p>
        </section>
      ) : (
        <>
          <section className="organizer-dashboard-stats">
            <DashboardStatCard
              icon={<FaCalendarAlt size={30} className="organizer-dashboard-stat-icon-events" />}
              label="Tổng sự kiện"
              value={numberFormat(dashboard.totalEvents)}
              trend={dashboard.trends.totalEvents}
            />
            <DashboardStatCard
              icon={<IoTicketSharp size={30} className="organizer-dashboard-stat-icon-tickets" />}
              label="Vé đã bán"
              value={numberFormat(dashboard.totalTicketsSold)}
              trend={dashboard.trends.totalTicketsSold}
            />
            <DashboardStatCard
              icon={<FaCheckCircle size={30} className="organizer-dashboard-stat-icon-occupancy" />}
              label="Tỷ lệ lấp đầy"
              value={percentFormat(dashboard.occupancyRate)}
              trend={dashboard.trends.occupancyRate}
            />
            <DashboardStatCard
              icon={<HiUserGroup size={30} className="organizer-dashboard-stat-icon-followers" />}
              label="Người theo dõi"
              value={numberFormat(profile?.followerCount)}
              trend={dashboard.trends.followerCount}
            />
          </section>

          <section className="organizer-dashboard-grid">
            <article className="organizer-panel organizer-chart-panel">
              <div className="organizer-panel-heading-row">
                <div>
                  <p className="organizer-dashboard-chart-title">
                    Sự kiện theo danh mục
                  </p>
                </div>
              </div>
              {categorySeries.length > 0 ? (
                <Chart
                  options={categoryChartOptions}
                  series={categorySeries}
                  type="donut"
                  height={350}
                />
              ) : (
                <div className="organizer-dashboard-empty-chart">
                  Chưa có dữ liệu danh mục.
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
                <div
                  className="organizer-dashboard-time-tabs"
                  aria-label="Chọn khoảng thời gian top sự kiện"
                >
                  {topEventRangeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={topEventRange === option.value ? "is-active" : ""}
                      onClick={() => setTopEventRange(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              {topEvents.length > 0 ? (
                <Chart
                  options={topEventChartOptions}
                  series={topEventSeries}
                  type="bar"
                  height={350}
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
              <div className="organizer-panel-heading-row" style={{ marginBottom: "18px" }}>
                <div>
                  <p className="organizer-dashboard-chart-title">Sự kiện sắp diễn ra</p>
                </div>
              </div>
              <div className="organizer-dashboard-event-list">
                {dashboard.upcomingEvents.length > 0 ? (
                  dashboard.upcomingEvents.map((event) => {
                    const primaryImage = event.images?.find((img) => img.isPrimary) || event.images?.[0];
                    const thumbnailUrl = primaryImage?.url;
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
                              {event.schedule?.startDatetime
                                ? new Date(event.schedule.startDatetime).toLocaleString(
                                    "vi-VN",
                                  )
                                : "Chưa có lịch"}
                            </span>
                          </div>
                        </div>
                        <span className={`organizer-tag ${
                          getStatusKey(event.status) === "PUBLISHED" ? "organizer-dashboard-status-published" : ""
                        }`}>
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
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center" }}>
                <div style={{ width: "100%", height: "200px", display: "flex", justifyContent: "center", alignItems: "center" }}>
                  <Chart
                    options={performanceChartOptions}
                    series={performanceSeries}
                    type="radialBar"
                    height={240}
                    width="100%"
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", width: "100%", textAlign: "center" }}>
                  <div style={{ background: "#f8fafc", padding: "10px 4px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "16px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>Sức chứa</span>
                    <strong style={{ fontSize: "16px", color: "#0f172a", fontWeight: 700 }}>{numberFormat(dashboard.totalCapacity)}</strong>
                  </div>
                  <div style={{ background: "#f8fafc", padding: "10px 4px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "16px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>Vé đã bán</span>
                    <strong style={{ fontSize: "16px", color: "#0f172a", fontWeight: 700 }}>{numberFormat(dashboard.totalTicketsSold)}</strong>
                  </div>
                  <div style={{ background: "#f8fafc", padding: "10px 4px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "16px", color: "#64748b", fontWeight: 600, display: "block", marginBottom: "4px" }}>Doanh thu ước tính</span>
                    <strong style={{ fontSize: "16px", color: "#0f172a", fontWeight: 700, whiteSpace: "nowrap" }}>{currencyFormat(dashboard.estimatedRevenue)}</strong>
                  </div>
                </div>
              </div>
            </article>
          </section>
        </>
      )}
    </OrganizerLayout>
  );
}


