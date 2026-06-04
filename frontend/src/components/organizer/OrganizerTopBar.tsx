import { FormEvent, useEffect, useMemo, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Search, X } from "lucide-react";
import { FaHome, FaUserAlt } from "react-icons/fa";
import { CgLogOut } from "react-icons/cg";
import { useTranslation } from "react-i18next";
import {
  organizerService,
  OrganizerProfile,
} from "../../services/organizerService";
import LanguageSwitcher from "../common/LanguageSwitcher";

export const ORGANIZER_PROFILE_UPDATED_EVENT =
  "flashTicket:organizerProfileUpdated";

type OrganizerSearchPage = {
  title: string;
  description: string;
  path: string;
  keywords: string[];
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getTokenString(tokenParsed: unknown, key: string): string | undefined {
  if (!tokenParsed || typeof tokenParsed !== "object") return undefined;
  const value = (tokenParsed as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

export default function OrganizerTopBar() {
  const { keycloak } = useKeycloak();
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [organizerProfile, setOrganizerProfile] =
    useState<OrganizerProfile | null>(null);

  const organizerSearchPages = useMemo<OrganizerSearchPage[]>(
    () => [
      {
        title: t("organizer.overview"),
        description: t("organizer.workspaceOverview"),
        path: "/organizer",
        keywords: ["dashboard", "overview", "tong quan"],
      },
      {
        title: t("organizer.eventManagement"),
        description: t("organizer.workspaceEvents"),
        path: "/organizer/events",
        keywords: ["events", "event", "su kien"],
      },
      {
        title: t("organizer.profile"),
        description: t("organizer.workspaceProfile"),
        path: "/organizer/profile",
        keywords: ["profile", "organizer", "ho so"],
      },
      {
        title: "Media",
        description: t("organizer.workspaceMedia"),
        path: "/organizer/media",
        keywords: ["media", "image", "anh"],
      },
      {
        title: t("nav.venues"),
        description: t("organizer.workspaceVenue"),
        path: "/venues",
        keywords: ["venue", "venues", "dia diem"],
      },
      {
        title: t("organizer.checkIn"),
        description: t("organizer.workspaceCheckIn"),
        path: "/organizer/check-in",
        keywords: ["checkin", "check-in", "qr"],
      },
    ],
    [t],
  );

  useEffect(() => {
    if (!keycloak.authenticated) {
      setOrganizerProfile(null);
      return;
    }

    let cancelled = false;

    const loadOrganizerProfile = async () => {
      try {
        const profile = await organizerService.getMyOrganizerProfile();
        if (!cancelled) setOrganizerProfile(profile);
      } catch {
        if (!cancelled) setOrganizerProfile(null);
      }
    };

    void loadOrganizerProfile();

    return () => {
      cancelled = true;
    };
  }, [keycloak.authenticated]);

  useEffect(() => {
    const handleProfileUpdated = (event: Event) => {
      const profile = (event as CustomEvent<OrganizerProfile>).detail;
      if (profile) setOrganizerProfile(profile);
    };

    window.addEventListener(
      ORGANIZER_PROFILE_UPDATED_EVENT,
      handleProfileUpdated,
    );
    return () => {
      window.removeEventListener(
        ORGANIZER_PROFILE_UPDATED_EVENT,
        handleProfileUpdated,
      );
    };
  }, []);

  const displayName =
    organizerProfile?.name ||
    getTokenString(keycloak.tokenParsed, "name") ||
    getTokenString(keycloak.tokenParsed, "preferred_username") ||
    "Organizer";
  const email =
    organizerProfile?.email ||
    getTokenString(keycloak.tokenParsed, "email") ||
    t("organizer.workspaceEmailFallback");
  const avatarUrl = organizerProfile?.logoUrl;
  const initial = displayName.charAt(0).toUpperCase();

  const matchingPages = useMemo(() => {
    const keyword = normalizeText(searchTerm.trim());
    if (!keyword) return organizerSearchPages.slice(0, 6);

    return organizerSearchPages
      .filter((page) =>
        normalizeText([page.title, page.description, page.path, ...page.keywords].join(" ")).includes(keyword),
      )
      .slice(0, 8);
  }, [organizerSearchPages, searchTerm]);

  const goToPage = (page: OrganizerSearchPage) => {
    navigate(page.path);
    setSearchTerm("");
    setIsSearchOpen(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const firstMatch = matchingPages[0];
    if (firstMatch) goToPage(firstMatch);
  };

  const handleLogout = () => {
    void keycloak.logout({ redirectUri: window.location.origin });
  };

  return (
    <div className="organizer-topbar">
      <form
        className="organizer-topbar-search"
        onSubmit={handleSubmit}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsSearchOpen(false);
          }
        }}
      >
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            setIsSearchOpen(true);
          }}
          onFocus={() => setIsSearchOpen(true)}
          placeholder={t("organizer.searchPagePlaceholder")}
        />
        {searchTerm ? (
          <button
            type="button"
            className="organizer-topbar-search-clear"
            onClick={() => {
              setSearchTerm("");
              setIsSearchOpen(true);
            }}
            aria-label={t("organizer.searchClear")}
          >
            <X size={15} />
          </button>
        ) : null}

        {isSearchOpen ? (
          <div className="organizer-topbar-search-results">
            {matchingPages.length > 0 ? (
              matchingPages.map((page) => (
                <button
                  key={page.path}
                  type="button"
                  className={`organizer-topbar-search-result ${
                    location.pathname === page.path ? "is-active" : ""
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => goToPage(page)}
                >
                  <strong>{page.title}</strong>
                  <span>{page.description}</span>
                </button>
              ))
            ) : (
              <div className="organizer-topbar-search-empty">
                {t("organizer.noMatchingPage")}
              </div>
            )}
          </div>
        ) : null}
      </form>

      <div className="organizer-topbar-actions">
        <div className="organizer-topbar-user-menu">
          <button
            type="button"
            className="organizer-topbar-user"
            aria-haspopup="menu"
            aria-label={t("organizer.openAccountMenu")}
          >
            <div className="organizer-topbar-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} />
              ) : (
                <span>{initial}</span>
              )}
            </div>
            <div className="organizer-topbar-user-copy">
              <strong>{displayName}</strong>
              <span>{email}</span>
            </div>
            <ChevronDown
              className="organizer-topbar-user-chevron"
              size={16}
              aria-hidden="true"
            />
          </button>

          <div className="organizer-topbar-dropdown" role="menu">
            <button type="button" role="menuitem" onClick={() => navigate("/")}>
              <FaHome size={16} />
              <span>{t("organizer.home")}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => navigate("/organizer/profile")}
            >
              <FaUserAlt size={15} />
              <span>{t("organizer.profile")}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="organizer-topbar-dropdown-logout"
              onClick={handleLogout}
            >
              <CgLogOut size={18} />
              <span>{t("organizer.logout")}</span>
            </button>
          </div>
        </div>
        <LanguageSwitcher className="language-switcher-organizer" />
      </div>
    </div>
  );
}
