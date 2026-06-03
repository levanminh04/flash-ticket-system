import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useKeycloak } from "@react-keycloak/web";
import {
  BadgeCheck,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { FaCalendarCheck, FaPhoneAlt, FaThumbsUp } from "react-icons/fa";
import { HiUserGroup } from "react-icons/hi2";
import { IoCalendarNumber, IoCameraOutline, IoTicketSharp } from "react-icons/io5";
import { MdMarkEmailRead } from "react-icons/md";
import { TbWorldCheck } from "react-icons/tb";
import { toast } from "react-toastify";
import OrganizerLayout from "../../components/organizer/OrganizerLayout";
import { ORGANIZER_PROFILE_UPDATED_EVENT } from "../../components/organizer/OrganizerTopBar";
import {
  organizerService,
  OrganizerProfile,
} from "../../services/organizerService";
import {
  OrganizerEventDetail,
  organizerWorkspaceService,
} from "../../services/organizerWorkspaceService";

const ORGANIZER_EVENTS_PAGE_SIZE = 100;

type OrganizerEventStats = {
  totalEvents: number;
  totalTicketsSold: number;
};

function formatRating(value?: number | null) {
  if (value == null) return "-";
  return Number(value).toFixed(1);
}

function statNumber(value: number | null | undefined, language: string) {
  if (value == null) return "-";
  return Number(value).toLocaleString(language === "en" ? "en-US" : "vi-VN");
}

function formatCreatedAt(value: string | null | undefined, language: string, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleString(language === "en" ? "en-US" : "vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function getOrganizerEventStats(events: OrganizerEventDetail[]): OrganizerEventStats {
  return {
    totalEvents: events.length,
    totalTicketsSold: events.reduce(
      (sum, event) => sum + (event.statistics?.ticketsSold ?? 0),
      0,
    ),
  };
}

export default function OrganizerProfilePage() {
  const { keycloak } = useKeycloak();
  const { i18n, t } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<OrganizerProfile | null>(null);
  const [eventStats, setEventStats] = useState<OrganizerEventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoUploading, setLogoUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!keycloak.authenticated) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [data, allEvents] = await Promise.all([
          organizerService.getMyOrganizerProfile(),
          getAllOrganizerEvents(),
        ]);
        if (!cancelled) {
          setProfile(data);
          setEventStats(getOrganizerEventStats(allEvents));
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
          setEventStats(null);
          setError(t("organizerProfile.loadFailed"));
          toast.error(t("organizerProfile.loadFailed"));
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
  }, [keycloak.authenticated, t]);

  const handleLogoSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLogoUploading(true);
    try {
      const updatedProfile = await organizerService.uploadLogo(file);
      setProfile(updatedProfile);
      window.dispatchEvent(
        new CustomEvent(ORGANIZER_PROFILE_UPDATED_EVENT, {
          detail: updatedProfile,
        }),
      );
      toast.success(t("organizerProfile.logoUpdated"));
    } catch {
      toast.error(t("organizerProfile.logoFailed"));
    } finally {
      event.target.value = "";
      setLogoUploading(false);
    }
  };

  const handleBannerSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBannerUploading(true);
    try {
      const updatedProfile = await organizerService.uploadBanner(file);
      setProfile(updatedProfile);
      window.dispatchEvent(
        new CustomEvent(ORGANIZER_PROFILE_UPDATED_EVENT, {
          detail: updatedProfile,
        }),
      );
      toast.success(t("organizerProfile.bannerUpdated"));
    } catch {
      toast.error(t("organizerProfile.bannerFailed"));
    } finally {
      event.target.value = "";
      setBannerUploading(false);
    }
  };

  return (
    <OrganizerLayout
      title={t("organizerProfile.title")}
      description={t("organizerProfile.description")}
      className="organizer-profile-page"
    >
      {loading ? (
        <section className="organizer-panel organizer-empty-state">
          <div className="loading-spinner" />
          <p>{t("organizerProfile.loading")}</p>
        </section>
      ) : error || !profile ? (
        <section className="organizer-panel organizer-empty-state">
          <ShieldCheck size={28} />
          <p>{error || t("organizerProfile.notFound")}</p>
        </section>
      ) : (
        <>
          <section className="organizer-panel organizer-profile-hero organizer-profile-summary-card">
            <div className="organizer-profile-banner">
              {profile.bannerUrl ? (
                <img src={profile.bannerUrl} alt={profile.name} />
              ) : (
                <span className="organizer-profile-banner-fallback" />
              )}
              <button
                type="button"
                className="organizer-profile-banner-upload-btn"
                onClick={() => bannerInputRef.current?.click()}
                disabled={bannerUploading}
                aria-label={t("organizerProfile.changeBanner")}
                title={t("organizerProfile.changeBanner")}
              >
                {bannerUploading ? (
                  <LoaderCircle size={16} className="spin" />
                ) : (
                  <IoCameraOutline size={20} />
                )}
              </button>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="organizer-hidden-file-input"
                onChange={handleBannerSelection}
              />
            </div>
            <div className="organizer-profile-card">
              <div className="organizer-profile-avatar-wrap">
                <div className="organizer-profile-avatar">
                  {profile.logoUrl ? (
                    <img src={profile.logoUrl} alt={profile.name} />
                  ) : (
                    <span>{profile.name.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="organizer-profile-logo-upload-btn"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  aria-label={t("organizerProfile.changeLogo")}
                  title={t("organizerProfile.changeLogo")}
                >
                  {logoUploading ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <IoCameraOutline size={20} />
                  )}
                </button>
                <span className="organizer-profile-avatar-status" aria-label={t("profile.active")} title={t("profile.active")} />
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="organizer-hidden-file-input"
                  onChange={handleLogoSelection}
                />
              </div>

              <div className="organizer-profile-copy">
                <div className="organizer-profile-info">
                  <div className="organizer-profile-field">
                    <div className="organizer-profile-field-value organizer-profile-field-value--title">
                      <h2>{profile.name}</h2>
                    </div>
                  </div>

                  <div className="organizer-profile-field organizer-profile-description">
                    <span className="organizer-profile-field-value">
                      {profile.description || t("organizerProfile.descriptionMissing")}
                    </span>
                  </div>

                  {profile.isVerified ? (
                    <div className="organizer-identity-row">
                      <span className="organizer-verified-pill">
                        <BadgeCheck size={14} />
                        {t("publicOrganizer.verified")}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="organizer-contact-grid">
                <div className="organizer-contact-item">
                  <MdMarkEmailRead size={20} />
                  <span>{profile.email || t("organizerProfile.emailMissing")}</span>
                </div>
                <div className="organizer-contact-item">
                  <FaPhoneAlt size={20} />
                  <span>{profile.phone || t("organizerProfile.phoneMissing")}</span>
                </div>
                <div className="organizer-contact-item">
                  <TbWorldCheck size={20} />
                  <span>{profile.websiteUrl || t("organizerProfile.websiteMissing")}</span>
                </div>
                <div className="organizer-contact-item">
                  <IoCalendarNumber size={20} />
                  <span>{formatCreatedAt(profile.createdAt, language, t("organizerProfile.noData"))}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="organizer-grid">
            <article className="organizer-panel organizer-stat-panel">
              <div className="organizer-panel-heading">
                <p className="organizer-badge">{t("organizerProfile.currentStats")}</p>
              </div>

              <div className="organizer-stats-grid">
                <div className="organizer-stat-card">
                  <FaCalendarCheck className="organizer-profile-stat-icon-events" size={32} />
                  <span>
                    <span className="organizer-stat-label">{t("organizerProfile.totalEvents")}</span>
                    <strong>{statNumber(eventStats?.totalEvents, language)}</strong>
                  </span>
                </div>
                <div className="organizer-stat-card">
                  <IoTicketSharp className="organizer-profile-stat-icon-tickets" size={32} />
                  <span>
                    <span className="organizer-stat-label">{t("publicOrganizer.ticketsSold")}</span>
                    <strong>{statNumber(eventStats?.totalTicketsSold, language)}</strong>
                  </span>
                </div>
                <div className="organizer-stat-card">
                  <HiUserGroup className="organizer-profile-stat-icon-followers" size={32} />
                  <span>
                    <span className="organizer-stat-label">{t("publicOrganizer.followers")}</span>
                    <strong>{statNumber(profile.followerCount, language)}</strong>
                  </span>
                </div>
                <div className="organizer-stat-card">
                  <FaThumbsUp className="organizer-profile-stat-icon-rating" size={32} />
                  <span>
                    <span className="organizer-stat-label">{t("organizerProfile.averageRating")}</span>
                    <strong>{formatRating(profile.averageRating)}</strong>
                  </span>
                </div>
              </div>
            </article>

            <article className="organizer-panel">
              <div className="organizer-panel-heading">
                <p className="organizer-badge">{t("organizerProfile.identityInfo")}</p>
              </div>

              <div className="organizer-profile-meta-list">
                <div className="organizer-profile-meta-row">
                  <strong>Organizer ID</strong>
                  <span className="organizer-profile-meta-value">{profile.id}</span>
                </div>
                <div className="organizer-profile-meta-row">
                  <strong>User ID</strong>
                  <span className="organizer-profile-meta-value">{profile.userId}</span>
                </div>
                <div className="organizer-profile-meta-row">
                  <strong>{t("organizerProfile.verificationStatus")}</strong>
                  <span className="organizer-profile-meta-value">
                    {profile.isVerified == null
                      ? "Unknown"
                      : profile.isVerified
                        ? "Verified"
                        : "Pending"}
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
