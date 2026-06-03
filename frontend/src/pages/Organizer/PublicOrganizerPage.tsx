import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useKeycloak } from "@react-keycloak/web";
import { Link, useParams } from "react-router-dom";
import {
  BadgeCheck,
  CalendarDays,
  Globe,
  Heart,
  LoaderCircle,
  Mail,
  Phone,
  Star,
  Ticket,
  Users,
} from "lucide-react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import Footer from "../../components/common/Footer";
import { eventService } from "../../services/eventService";
import { OrganizerProfile, organizerService } from "../../services/organizerService";
import { EventSummary } from "../../types/api";

const PUBLIC_EVENTS_PAGE_SIZE = 100;

function statNumber(value: number | null | undefined, language: string) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat(language === "en" ? "en-US" : "vi-VN").format(value)
    : "0";
}

function organizerInitials(name?: string | null) {
  if (!name) return "FT";
  return name
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

async function getCandidatePublicEvents(organizerId: string): Promise<EventSummary[]> {
  const firstPage = await eventService.getEvents({
    organizerId,
    page: 0,
    size: PUBLIC_EVENTS_PAGE_SIZE,
    sort: "startDatetime,asc",
  });
  const firstPageEvents = firstPage.content ?? [];

  if (firstPage.totalPages <= 1) {
    return firstPageEvents;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      eventService.getEvents({
        organizerId,
        page: index + 1,
        size: PUBLIC_EVENTS_PAGE_SIZE,
        sort: "startDatetime,asc",
      }),
    ),
  );

  return [
    ...firstPageEvents,
    ...remainingPages.flatMap((page) => page.content ?? []),
  ];
}

function belongsToOrganizer(
  event: EventSummary,
  organizerUserId: string,
  organizerProfileId: string,
) {
  return (
    event.organizer?.userId === organizerUserId ||
    event.organizer?.id === organizerUserId ||
    event.organizer?.id === organizerProfileId
  );
}

async function getVerifiedPublicOrganizerEvents(
  organizerUserId: string,
  organizerProfileId: string,
): Promise<EventSummary[]> {
  const candidates = await getCandidatePublicEvents(organizerUserId);

  if (candidates.length === 0) {
    return [];
  }

  const detailedEvents = await Promise.all(
    candidates.map(async (event) => {
      const idOrSlug = event.slug || event.id;
      if (!idOrSlug) return event;

      try {
        return await eventService.getEventDetails(idOrSlug);
      } catch {
        return event;
      }
    }),
  );

  return detailedEvents.filter((event) =>
    belongsToOrganizer(event, organizerUserId, organizerProfileId),
  );
}

function getTicketsSold(events: EventSummary[]) {
  return events.reduce(
    (sum, event) => sum + (event.statistics?.ticketsSold ?? event.ticketsSold ?? 0),
    0,
  );
}

export default function PublicOrganizerPage() {
  const { i18n, t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const { keycloak, initialized } = useKeycloak();
  const queryClient = useQueryClient();
  const language = i18n.resolvedLanguage || "vi";

  const {
    data: organizer,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["public-organizer", slug],
    queryFn: () => organizerService.getPublicOrganizerBySlug(slug || ""),
    enabled: Boolean(slug),
  });

  const organizerProfileId = organizer?.id;
  const organizerUserId = organizer?.userId;
  const isOwnOrganizer = keycloak.subject && keycloak.subject === organizerUserId;

  const { data: publicEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["public-organizer-events", organizerUserId, organizerProfileId],
    queryFn: () =>
      getVerifiedPublicOrganizerEvents(organizerUserId || "", organizerProfileId || ""),
    enabled: Boolean(organizerUserId) && Boolean(organizerProfileId),
  });

  const { data: isFollowing = false } = useQuery({
    queryKey: ["organizer-follow-status", organizerProfileId],
    queryFn: () => organizerService.isFollowingOrganizer(organizerProfileId || ""),
    enabled:
      initialized &&
      Boolean(keycloak.authenticated) &&
      Boolean(organizerProfileId) &&
      !isOwnOrganizer,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!organizerProfileId) throw new Error("Missing organizer profile id");
      return isFollowing
        ? organizerService.unfollowOrganizer(organizerProfileId)
        : organizerService.followOrganizer(organizerProfileId);
    },
    onSuccess: (response) => {
      queryClient.setQueryData(
        ["organizer-follow-status", organizerProfileId],
        response.isFollowing,
      );
      queryClient.setQueryData<OrganizerProfile | undefined>(
        ["public-organizer", slug],
        (current) =>
          current
            ? {
                ...current,
                followerCount: response.followerCount,
              }
            : current,
      );
      toast.success(
        response.isFollowing
          ? t("publicOrganizer.followSuccess")
          : t("publicOrganizer.unfollowSuccess"),
      );
    },
    onError: () => {
      toast.error(t("publicOrganizer.followFailed"));
    },
  });

  const handleFollowClick = () => {
    if (!keycloak.authenticated) {
      void keycloak.login();
      return;
    }
    followMutation.mutate();
  };

  if (isLoading) {
    return (
      <main className="public-organizer-page">
        <div className="event-detail-loading" role="status" aria-live="polite">
          <LoaderCircle className="event-detail-loading-icon" size={24} />
          <span>{t("publicOrganizer.loading")}</span>
        </div>
      </main>
    );
  }

  if (isError || !organizer) {
    return (
      <main className="public-organizer-page">
        <section className="public-organizer-state">
          <h1>{t("publicOrganizer.notFoundTitle")}</h1>
          <p>{t("publicOrganizer.notFoundDescription")}</p>
          <Link className="btn btn-primary" to="/search">
            {t("publicOrganizer.searchOther")}
          </Link>
        </section>
      </main>
    );
  }

  const heroImageUrl = organizer.bannerUrl || organizer.logoUrl || null;
  const heroClassName = [
    "public-organizer-hero",
    organizer.bannerUrl ? "" : "public-organizer-hero--no-banner",
  ]
    .filter(Boolean)
    .join(" ");
  const totalEvents = publicEvents.length;
  const totalTicketsSold = getTicketsSold(publicEvents);

  return (
    <main className="public-organizer-page">
      <section
        className={heroClassName}
        style={heroImageUrl ? { backgroundImage: `url(${heroImageUrl})` } : undefined}
      >
        <div className="public-organizer-hero-overlay" />
        <div className="container public-organizer-hero-content">
          <div className="public-organizer-avatar">
            {organizer.logoUrl ? (
              <img src={organizer.logoUrl} alt={organizer.name} />
            ) : (
              <span>{organizerInitials(organizer.name)}</span>
            )}
          </div>

          <div className="public-organizer-copy">
            <div className="public-organizer-title-row">
              <h1>{organizer.name}</h1>
              {organizer.isVerified ? (
                <span className="public-organizer-verified">
                  <BadgeCheck size={16} />
                  {t("publicOrganizer.verified")}
                </span>
              ) : null}
            </div>
            <p>{organizer.description || t("publicOrganizer.descriptionMissing")}</p>
            <div className="public-organizer-actions">
              {!isOwnOrganizer ? (
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={handleFollowClick}
                  disabled={followMutation.isPending}
                >
                  {followMutation.isPending ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Heart size={16} />
                  )}
                  {isFollowing ? t("publicOrganizer.unfollow") : t("publicOrganizer.follow")}
                </button>
              ) : null}
              {!organizer.bannerUrl ? (
                <span className="public-organizer-banner-note">
                  {t("publicOrganizer.bannerMissing")}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="container public-organizer-content">
        <div className="public-organizer-stats">
          <div className="public-organizer-stat">
            <CalendarDays size={24} />
            <div className="public-organizer-stat-info">
              <span>{t("publicOrganizer.eventsOnSale")}</span>
              <strong>{eventsLoading ? "..." : statNumber(totalEvents, language)}</strong>
            </div>
          </div>
          <div className="public-organizer-stat">
            <Ticket size={24} />
            <div className="public-organizer-stat-info">
              <span>{t("publicOrganizer.ticketsSold")}</span>
              <strong>{eventsLoading ? "..." : statNumber(totalTicketsSold, language)}</strong>
            </div>
          </div>
          <div className="public-organizer-stat">
            <Users size={24} />
            <div className="public-organizer-stat-info">
              <span>{t("publicOrganizer.followers")}</span>
              <strong>{statNumber(organizer.followerCount, language)}</strong>
            </div>
          </div>
          <div className="public-organizer-stat">
            <Star size={24} />
            <div className="public-organizer-stat-info">
              <span>{t("publicOrganizer.averageRating")}</span>
              <strong>
                {typeof organizer.averageRating === "number"
                  ? organizer.averageRating.toFixed(1)
                  : "0.0"}
              </strong>
            </div>
          </div>
        </div>

        <section className="public-organizer-info">
          <h2>{t("publicOrganizer.contactInfo")}</h2>

          <div className="public-organizer-contact-grid">
            <div className="public-organizer-contact">
              <Mail size={24} />
              <div className="public-organizer-contact-info">
                <span>Email</span>
                <strong>{organizer.email || t("publicOrganizer.emailMissing")}</strong>
              </div>
            </div>
            <div className="public-organizer-contact">
              <Phone size={24} />
              <div className="public-organizer-contact-info">
                <span>{t("publicOrganizer.phone")}</span>
                <strong>{organizer.phone || t("publicOrganizer.emailMissing")}</strong>
              </div>
            </div>
            <div className="public-organizer-contact">
              <Globe size={24} />
              <div className="public-organizer-contact-info">
                <span>Website</span>
                {organizer.websiteUrl ? (
                  <a href={organizer.websiteUrl} target="_blank" rel="noreferrer">
                    {organizer.websiteUrl}
                  </a>
                ) : (
                  <strong>{t("publicOrganizer.websiteMissing")}</strong>
                )}
              </div>
            </div>
          </div>
        </section>
      </section>

      <Footer />
    </main>
  );
}
