import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Chart from "react-apexcharts";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FilePenLine,
  ImagePlus,
  Plus,
} from "lucide-react";
import { ApexOptions } from "apexcharts";
import { IoCalendarNumberSharp, IoTicketSharp } from "react-icons/io5";
import { HiTicket } from "react-icons/hi2";
import { FaMoneyBill1Wave } from "react-icons/fa6";
import { FaCheckCircle } from "react-icons/fa";
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

type EventStatusKey = "DRAFT" | "PUBLISHED" | "SOLD_OUT" | "CANCELLED";
type RevenueRange = "week" | "month" | "year";

type ActionItem = {
  id: string;
  title: string;
  description: string;
  to: string;
  actionLabel: string;
  icon: React.ElementType;
};

const ORGANIZER_EVENTS_PAGE_SIZE = 100;

const revenueRangeOptions: Array<{ value: RevenueRange; label: string }> = [
  { value: "week", label: "organizerHub.rangeWeek" },
  { value: "month", label: "organizerHub.rangeMonth" },
  { value: "year", label: "organizerHub.rangeYear" },
];

const categoryRevenueColors = [
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#F59E0B",
  "#EC4899",
  "#06B6D4",
  "#F97316",
  "#64748B",
  "#14B8A6",
  "#A855F7",
];

const eventStatusMeta: Record<
  EventStatusKey,
  { label: string; className: string }
> = {
  DRAFT: { label: "status.draft", className: "is-draft" },
  PUBLISHED: { label: "status.published", className: "is-published" },
  SOLD_OUT: { label: "status.soldOut", className: "is-sold-out" },
  CANCELLED: { label: "status.cancelled", className: "is-cancelled" },
};

function numberFormat(value: number | null | undefined, language: string): string {
  return Number(value ?? 0).toLocaleString(language === "en" ? "en-US" : "vi-VN");
}

function currencyFormat(value: number, language: string): string {
  return `${Math.round(value).toLocaleString(language === "en" ? "en-US" : "vi-VN")} đ`;
}

function getEventStatus(status?: string): EventStatusKey {
  if (
    status === "PUBLISHED" ||
    status === "SOLD_OUT" ||
    status === "CANCELLED"
  ) {
    return status;
  }
  return "DRAFT";
}

function isEventInRevenueRange(event: OrganizerEventDetail, range: RevenueRange): boolean {
  const time = new Date(event.schedule?.startDatetime ?? "").getTime();
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

async function getAllOrganizerEvents(): Promise<OrganizerEventDetail[]> {
  const firstPage = await organizerWorkspaceService.getMyEvents(
    0,
    ORGANIZER_EVENTS_PAGE_SIZE,
    "createdAt,desc",
  );
  const firstPageEvents = firstPage.content ?? [];

  if (firstPage.totalPages <= 1) return firstPageEvents;

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

function HubKpiCard({
  icon: Icon,
  label,
  value,
  description,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  description: string;
  iconColor?: string;
}) {
  return (
    <article className="organizer-hub-kpi-card">
      <span className="organizer-hub-kpi-icon" style={iconColor ? { color: iconColor } : undefined}>
        <Icon size={36} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{description}</small>
      </div>
    </article>
  );
}

export default function OrganizerHubPage() {
  const { ready } = useOrganizerGate();
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const [profile, setProfile] = useState<OrganizerProfile | null>(null);
  const [events, setEvents] = useState<OrganizerEventDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revenueRange, setRevenueRange] = useState<RevenueRange>("year");

  useEffect(() => {
    if (!ready) return;

    let cancelled = false;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const [profileData, organizerEvents] = await Promise.all([
          organizerService.getMyOrganizerProfile(),
          getAllOrganizerEvents(),
        ]);

        if (!cancelled) {
          setProfile(profileData);
          setEvents(organizerEvents);
        }
      } catch {
        if (!cancelled) {
          setError(t("organizerHub.loadFailed"));
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
  }, [ready, t]);

  const dashboard = useMemo(() => {
    const statusCounts = events.reduce<Record<EventStatusKey, number>>(
      (counts, event) => {
        counts[getEventStatus(event.status)] += 1;
        return counts;
      },
      { DRAFT: 0, PUBLISHED: 0, SOLD_OUT: 0, CANCELLED: 0 },
    );

    const activeEvents = events.filter((event) => event.status === "PUBLISHED");
    const totalTicketsSold = activeEvents.reduce(
      (sum, event) => sum + getEventTicketsSold(event),
      0,
    );
    const totalCapacity = activeEvents.reduce(
      (sum, event) => sum + getEventTicketCapacity(event),
      0,
    );
    const estimatedRevenue = activeEvents.reduce(
      (sum, event) => sum + getEventEstimatedRevenue(event),
      0,
    );
    const occupancyRate =
      totalCapacity > 0
        ? Math.min(Math.round((totalTicketsSold / totalCapacity) * 100), 100)
        : 0;
    const categoryRevenueMap = activeEvents.reduce((map, event) => {
      const revenue = getEventEstimatedRevenue(event);
      const categories = event.categories?.length
        ? event.categories
        : [{ name: t("organizerHub.uncategorized") }];
      const revenuePerCategory = categories.length > 0 ? revenue / categories.length : revenue;

      categories.forEach((category) => {
        const label = category.name || t("organizerHub.uncategorized");
        map.set(label, (map.get(label) ?? 0) + revenuePerCategory);
      });
      return map;
    }, new Map<string, number>());
    const categoryRevenueItems = [...categoryRevenueMap.entries()]
      .map(([label, value], index) => ({
        label,
        value,
        color: categoryRevenueColors[index % categoryRevenueColors.length],
      }))
      .sort((a, b) => b.value - a.value);
    const actionItems = events
      .filter((event) => event.status === "DRAFT")
      .flatMap<ActionItem>((event) => {
        const items: ActionItem[] = [];
        const eventPath = `/organizer/events/${event.id}`;

        if (!event.images?.length) {
          items.push({
            id: `${event.id}-images`,
            title: event.title,
            description: t("organizerHub.actionImageDescription"),
            to: `${eventPath}/media`,
            actionLabel: t("organizerHub.addImage"),
            icon: ImagePlus,
          });
        }

        if (!event.ticketTypes?.length) {
          items.push({
            id: `${event.id}-tickets`,
            title: event.title,
            description: t("organizerHub.actionTicketDescription"),
            to: `${eventPath}/edit`,
            actionLabel: t("organizerHub.continue"),
            icon: IoTicketSharp,
          });
        }

        if (items.length === 0) {
          items.push({
            id: `${event.id}-publish`,
            title: event.title,
            description: t("organizerHub.actionPublishDescription"),
            to: `${eventPath}/edit`,
            actionLabel: t("organizerHub.continue"),
            icon: FilePenLine,
          });
        }

        return items;
      })
      .slice(0, 5);

    return {
      statusCounts,
      totalTicketsSold,
      estimatedRevenue,
      occupancyRate,
      categoryRevenueItems,
      actionItems,
    };
  }, [events, t]);

  const filteredRevenueEvents = useMemo(
    () =>
      events
        .filter((event) => event.status === "PUBLISHED")
        .filter((event) => isEventInRevenueRange(event, revenueRange))
        .map((event) => ({ event, revenue: getEventEstimatedRevenue(event) }))
        .filter((item) => item.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8),
    [events, revenueRange],
  );

  const categoryRevenueSeries = useMemo(
    () => dashboard.categoryRevenueItems.map((item) => Math.round(item.value)),
    [dashboard.categoryRevenueItems],
  );

  const categoryRevenueOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: "donut",
        toolbar: { show: false },
        fontFamily: "Inter, system-ui, sans-serif",
      },
      labels: dashboard.categoryRevenueItems.map((item) => item.label),
      colors: dashboard.categoryRevenueItems.map((item) => item.color),
      dataLabels: { enabled: false },
      legend: {
        position: "bottom",
        fontWeight: 700,
        labels: { colors: "#475569" },
      },
      plotOptions: {
        pie: {
          donut: {
            size: "66%",
            labels: {
              show: true,
              total: {
                show: true,
                label: t("organizerHub.revenue"),
                formatter: () => currencyFormat(dashboard.estimatedRevenue, language),
              },
            },
          },
        },
      },
      stroke: { width: 0 },
      tooltip: {
        y: { formatter: (value) => currencyFormat(Number(value), language) },
      },
    }),
    [dashboard.categoryRevenueItems, dashboard.estimatedRevenue, language, t],
  );

  const revenueByRangeOptions = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: "bar",
        toolbar: { show: false },
        fontFamily: "Inter, system-ui, sans-serif",
      },
      colors: ["#10B981"],
      dataLabels: { enabled: false },
      grid: { borderColor: "#e2e8f0", strokeDashArray: 4 },
      plotOptions: {
        bar: {
          borderRadius: 8,
          columnWidth: "46%",
        },
      },
      xaxis: {
        categories: filteredRevenueEvents.map(({ event }) => event.title),
        labels: {
          rotate: -30,
          trim: true,
          maxHeight: 110,
          style: { colors: "#64748b", fontWeight: 700 },
        },
      },
      yaxis: {
        labels: {
          style: { colors: "#334155", fontWeight: 700 },
          formatter: (value) => currencyFormat(Number(value), language),
        },
      },
      tooltip: {
        y: { formatter: (value) => currencyFormat(Number(value), language) },
      },
    }),
    [filteredRevenueEvents, language],
  );

  const revenueByRangeSeries = useMemo(
    () => [
      {
        name: t("organizerHub.revenue"),
        data: filteredRevenueEvents.map((item) => Math.round(item.revenue)),
      },
    ],
    [filteredRevenueEvents, t],
  );

  return (
    <OrganizerLayout
      title={t("organizerHub.greeting", { name: profile?.name ? `, ${profile.name}` : "" })}
      description={t("organizerHub.description")}
      className="organizer-hub-page"
      actions={
        <div className="organizer-hub-header-actions">
          <Link className="organizer-events-add-button" to="/organizer/events/new">
            <Plus size={18} />
            {t("organizerHub.createEvent")}
          </Link>
        </div>
      }
    >
      {loading ? (
        <section className="organizer-panel organizer-empty-state">
          <div className="loading-spinner" />
          <p>{t("organizerHub.loading")}</p>
        </section>
      ) : error ? (
        <section className="organizer-panel organizer-dashboard-state">
          <AlertCircle size={28} />
          <p>{error}</p>
        </section>
      ) : (
        <>
          <section className="organizer-hub-kpi-grid" aria-label={t("organizerHub.operationalMetrics")}>
            <HubKpiCard
              icon={IoCalendarNumberSharp}
              label={t("organizerHub.publishedEvents")}
              value={numberFormat(dashboard.statusCounts.PUBLISHED, language)}
              description={t("organizerHub.publishedEventsDescription")}
              iconColor="#60a5fa"
            />
            <HubKpiCard
              icon={HiTicket}
              label={t("publicOrganizer.ticketsSold")}
              value={numberFormat(dashboard.totalTicketsSold, language)}
              description={t("organizerHub.ticketsSoldDescription")}
              iconColor="#34d399"
            />
            <HubKpiCard
              icon={FaMoneyBill1Wave}
              label={t("organizerHub.estimatedRevenue")}
              value={currencyFormat(dashboard.estimatedRevenue, language)}
              description={t("organizerHub.estimatedRevenueDescription")}
              iconColor="#fbbf24"
            />
            <HubKpiCard
              icon={FaCheckCircle}
              label={t("organizerHub.occupancyRate")}
              value={`${dashboard.occupancyRate}%`}
              description={t("organizerHub.occupancyRateDescription")}
              iconColor="#a78bfa"
            />
          </section>

          <section className="organizer-hub-chart-grid">
            <article className="organizer-panel organizer-hub-chart-card">
              <div className="organizer-hub-panel-heading">
                <div>
                  <h2>{t("organizerHub.revenueByCategory")}</h2>
                  <p>{t("organizerHub.revenueByCategoryDescription")}</p>
                </div>
              </div>
              {categoryRevenueSeries.length > 0 ? (
                <Chart
                  options={categoryRevenueOptions}
                  series={categoryRevenueSeries}
                  type="donut"
                  height={350}
                />
              ) : (
                <div className="organizer-hub-empty">
                  <p>{t("organizerHub.emptyCategoryRevenue")}</p>
                </div>
              )}
            </article>

            <article className="organizer-panel organizer-hub-chart-card">
              <div className="organizer-hub-panel-heading organizer-hub-chart-heading">
                <div>
                  <h2>{t("organizerHub.revenueByEvent")}</h2>
                  <p>{t("organizerHub.revenueByEventDescription")}</p>
                </div>
                <div
                  className="organizer-dashboard-time-tabs"
                  aria-label={t("organizerHub.selectRevenueRange")}
                >
                  {revenueRangeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={revenueRange === option.value ? "is-active" : ""}
                      onClick={() => setRevenueRange(option.value)}
                    >
                      {t(option.label)}
                    </button>
                  ))}
                </div>
              </div>
              {filteredRevenueEvents.length > 0 ? (
                <Chart
                  options={revenueByRangeOptions}
                  series={revenueByRangeSeries}
                  type="bar"
                  height={350}
                />
              ) : (
                <div className="organizer-hub-empty">
                  <p>{t("organizerHub.emptyRangeRevenue")}</p>
                </div>
              )}
            </article>
          </section>

          <section className="organizer-hub-main-grid">
            <article className="organizer-panel organizer-hub-action-panel">
              <div className="organizer-hub-panel-heading">
                <div>
                  <h2>{t("organizerHub.todo")}</h2>
                  <p>{t("organizerHub.todoDescription")}</p>
                </div>
              </div>

              <div className="organizer-hub-action-list">
                {dashboard.actionItems.length > 0 ? (
                  dashboard.actionItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div className="organizer-hub-action-row" key={item.id}>
                        <span className={`organizer-hub-action-icon ${item.icon === IoTicketSharp ? "no-bg" : ""}`}>
                          <Icon size={item.icon === IoTicketSharp ? 22 : 19} />
                        </span>
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.description}</p>
                        </div>
                        <Link to={item.to}>
                          {item.actionLabel}
                          <ArrowRight size={16} />
                        </Link>
                      </div>
                    );
                  })
                ) : (
                  <div className="organizer-hub-empty">
                    <CheckCircle2 size={24} />
                    <p>{t("organizerHub.emptyTodo")}</p>
                  </div>
                )}
              </div>
            </article>

            <article className="organizer-panel organizer-hub-status-panel">
              <div className="organizer-hub-panel-heading">
                <div>
                  <h2>{t("organizerHub.eventStatus")}</h2>
                  <p>{t("organizerHub.eventStatusDescription")}</p>
                </div>
                <Link className="organizer-hub-panel-link" to="/organizer/events">
                  {t("organizerHub.viewAll")}
                  <ArrowRight size={16} />
                </Link>
              </div>
              <div className="organizer-hub-status-list">
                {(Object.keys(eventStatusMeta) as EventStatusKey[]).map((status) => (
                  <div className="organizer-hub-status-row" key={status}>
                    <span className={`organizer-hub-status-dot ${eventStatusMeta[status].className}`} />
                    <span style={status === "PUBLISHED" ? { fontWeight: 700 } : undefined}>
                      {t(eventStatusMeta[status].label)}
                    </span>
                    <strong>{numberFormat(dashboard.statusCounts[status], language)}</strong>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </>
      )}
    </OrganizerLayout>
  );
}
