import { FormEvent, useEffect, useMemo, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { FaHome, FaUserAlt } from "react-icons/fa";
import { CgLogOut } from "react-icons/cg";
import {
  organizerService,
  OrganizerProfile,
} from "../../services/organizerService";

export const ORGANIZER_PROFILE_UPDATED_EVENT =
  "flashTicket:organizerProfileUpdated";

type OrganizerSearchPage = {
  title: string;
  description: string;
  path: string;
  keywords: string[];
};

const organizerSearchPages: OrganizerSearchPage[] = [
  {
    title: "Tổng quan",
    description: "Dashboard điều hành workspace organizer",
    path: "/organizer",
    keywords: ["dashboard", "overview", "tong quan"],
  },
  {
    title: "Quản lý sự kiện",
    description: "Danh sách, doanh thu, vé bán và thao tác sự kiện",
    path: "/organizer/events",
    keywords: ["events", "event", "su kien"],
  },
  {
    title: "Hồ sơ ban tổ chức",
    description: "Thông tin liên hệ và nhận diện organizer",
    path: "/organizer/profile",
    keywords: ["profile", "organizer", "ho so"],
  },
  {
    title: "Thư viện ảnh",
    description: "Banner, poster, thumbnail và gallery sự kiện",
    path: "/organizer/media",
    keywords: ["media", "image", "anh"],
  },
  {
    title: "Địa điểm",
    description: "Danh sách venue, sức chứa và tiện ích",
    path: "/venues",
    keywords: ["venue", "venues", "dia diem"],
  },
  {
    title: "Check-in",
    description: "Quét QR và xác nhận vé tại cổng",
    path: "/organizer/check-in",
    keywords: ["checkin", "check-in", "qr"],
  },
];

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
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [organizerProfile, setOrganizerProfile] =
    useState<OrganizerProfile | null>(null);

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
    "workspace@flash-ticket.vn";
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
  }, [searchTerm]);

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
          placeholder="Tìm kiếm trang..."
        />
        {searchTerm ? (
          <button
            type="button"
            className="organizer-topbar-search-clear"
            onClick={() => {
              setSearchTerm("");
              setIsSearchOpen(true);
            }}
            aria-label="Xóa từ khóa tìm kiếm"
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
              <div className="organizer-topbar-search-empty">Không có trang phù hợp</div>
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
            aria-label="Mở menu tài khoản"
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
          </button>

          <div className="organizer-topbar-dropdown" role="menu">
            <button type="button" role="menuitem" onClick={() => navigate("/")}>
              <FaHome size={16} />
              <span>Home</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => navigate("/organizer/profile")}
            >
              <FaUserAlt size={15} />
              <span>Profile</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="organizer-topbar-dropdown-logout"
              onClick={handleLogout}
            >
              <CgLogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
