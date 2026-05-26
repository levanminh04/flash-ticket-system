// File: src/components/layout/Navbar.tsx
import { useEffect, useMemo, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import {
  ChevronDown,
  Clock3,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Search,
  ShoppingBag,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { HiTicket } from "react-icons/hi2";
import { RiAccountCircleFill, RiShoppingBag3Fill } from "react-icons/ri";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { confirmDestructiveAction } from "../../lib/swal";
import { hasRealmRole } from "../../lib/auth";
import { eventService } from "../../services/eventService";
import { userService, UserProfile } from "../../services/userService";
import { EventSummary } from "../../types/api";
import { CHATBOT_PROMPT_EVENT } from "../chatbot/FloatingChatbot";

const LOGIN_TOAST_KEY = "flashTicket:pendingLoginToast";
export const PROFILE_UPDATED_EVENT = "flashTicket:profileUpdated";
const defaultQuickPrompt = "Các sự kiện nổi bật sắp diễn ra";
const quickPrompts = [
  "Sự kiện âm nhạc sắp diễn ra",
  "Gợi ý sự kiện cuối tuần tại TP.HCM",
  "Sự kiện thể thao đang mở bán",
];

function getSuggestionImage(event: EventSummary) {
  return (
    event.thumbnailUrl ||
    event.bannerUrl ||
    event.images?.find((image) => image.type === "THUMBNAIL")?.url ||
    event.images?.find((image) => image.type === "BANNER")?.url ||
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=500&auto=format&fit=crop"
  );
}

function getSuggestionStartDate(event: EventSummary) {
  return new Date(event.schedule?.startDatetime || event.startDatetime);
}

function formatSuggestionDate(event: EventSummary) {
  const date = getSuggestionStartDate(event);
  if (Number.isNaN(date.getTime())) return "Đang cập nhật";

  return date
    .toLocaleDateString("vi-VN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .replace(" tháng ", " Tháng ");
}

function normalizeSuggestionText(value?: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

function getSuggestionSearchText(event: EventSummary) {
  return normalizeSuggestionText(
    [
      event.title,
      event.shortDescription,
      event.category?.name,
      event.venue?.name,
      event.venue?.city,
      event.venueName,
      event.city,
      ...(event.tags || []),
      ...(event.categories || []).map((category) => category.name),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function getUpcomingSuggestions(events: EventSummary[], keyword: string) {
  const now = new Date();
  const keywordParts = normalizeSuggestionText(keyword).split(/\s+/).filter(Boolean);

  return events
    .filter((event) => {
      const startDate = getSuggestionStartDate(event);
      if (Number.isNaN(startDate.getTime()) || startDate < now) return false;

      const eventText = getSuggestionSearchText(event);
      return keywordParts.every((part) => eventText.includes(part));
    })
    .sort(
      (first, second) =>
        getSuggestionStartDate(first).getTime() -
        getSuggestionStartDate(second).getTime(),
    )
    .slice(0, 3);
}

const Navbar = () => {
  const { keycloak, initialized } = useKeycloak();
  const location = useLocation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [showAuthPopup, setShowAuthPopup] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<EventSummary[]>([]);
  const isAuthenticated = initialized && !!keycloak?.authenticated;
  const hasOrganizerTokenRole = hasRealmRole(keycloak?.tokenParsed, "ORGANIZER");
  const hasOrganizerProfileRole = Boolean(
    profile?.roles?.some((role) => role.toUpperCase() === "ORGANIZER"),
  );
  const isOrganizer = hasOrganizerTokenRole || hasOrganizerProfileRole;
  const isAdmin = hasRealmRole(keycloak?.tokenParsed, "ADMIN");
  const hasOrganizerApplication = Boolean(profile?.organizerProfileId);
  const canEditHomePage =
    isOrganizer ||
    isAdmin ||
    hasRealmRole(keycloak?.tokenParsed, "admin") ||
    hasRealmRole(keycloak?.tokenParsed, "ADIM") ||
    hasRealmRole(keycloak?.tokenParsed, "adim") ||
    hasRealmRole(keycloak?.tokenParsed, "organizer");
  const isOrganizerWorkspace = isOrganizer && location.pathname.startsWith("/organizer");

  const accountName = (
    profile?.displayName ||
    `${profile?.firstName || ""} ${profile?.lastName || ""}`.trim() ||
    (keycloak.tokenParsed?.name as string | undefined) ||
    `${keycloak.tokenParsed?.given_name || ""} ${keycloak.tokenParsed?.family_name || ""}`.trim() ||
    keycloak.tokenParsed?.preferred_username ||
    "User"
  ).trim();

  const accountEmail =
    profile?.email ?? (keycloak.tokenParsed?.email as string | undefined) ?? "";

  const usernameRaw =
    (keycloak.tokenParsed?.preferred_username as string | undefined) ||
    (accountEmail.includes("@") ? accountEmail.split("@")[0] : "") ||
    accountName.replace(/\s+/g, ".").toLowerCase();

  const defaultAvatar = useMemo(() => {
    const defaultAvatarSeed = encodeURIComponent(usernameRaw || "flashticket-user");
    return `https://api.dicebear.com/7.x/initials/svg?seed=${defaultAvatarSeed}&backgroundColor=f59e0b,c084fc,34d399,60a5fa&fontWeight=700`;
  }, [usernameRaw]);

  const avatarSrc = !avatarBroken
    ? profile?.avatarUrl || defaultAvatar
    : defaultAvatar;

  const handleLogout = async () => {
    const confirmed = await confirmDestructiveAction({
      title: "Đăng xuất khỏi phiên hiện tại?",
      text: "Bạn sẽ cần đăng nhập lại để tiếp tục mua vé hoặc xem thông tin tài khoản.",
      confirmButtonText: "Đăng xuất",
      cancelButtonText: "Ở lại",
    });
    if (!confirmed) return;

    await keycloak.logout({
      redirectUri: `${window.location.origin}/`,
    });
  };

  const handleQuickPrompt = (prompt: string) => {
    window.dispatchEvent(new CustomEvent(CHATBOT_PROMPT_EVENT, { detail: prompt }));
  };

  const requireLogin = () => {
    sessionStorage.setItem(LOGIN_TOAST_KEY, "1");
    void keycloak?.login();
  };

  const handleLogin = () => {
    sessionStorage.setItem(LOGIN_TOAST_KEY, "1");
    void keycloak?.login();
  };

  const handleRegister = () => {
    void keycloak?.register();
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    const shouldNotify = sessionStorage.getItem(LOGIN_TOAST_KEY) === "1";
    if (!shouldNotify) return;

    toast.success("Đăng nhập thành công");
    sessionStorage.removeItem(LOGIN_TOAST_KEY);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setProfile(null);
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      const data = await userService.getProfile();
      if (!cancelled) {
        setProfile(data);
        setAvatarBroken(false);
      }
    };

    void loadProfile();

    window.addEventListener(PROFILE_UPDATED_EVENT, loadProfile);
    return () => {
      cancelled = true;
      window.removeEventListener(PROFILE_UPDATED_EVENT, loadProfile);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const keyword = searchTerm.trim();
    if (keyword.length < 2) {
      setSearchSuggestions([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const page = await eventService.getEvents({
          search: keyword,
          size: 8,
          sort: "startDatetime,asc",
        });
        let upcoming = getUpcomingSuggestions(page.content, keyword);

        if (upcoming.length < 3) {
          const [fallbackKeyword] = keyword.split(/\s+/);
          const fallbackPage = await eventService.getEvents({
            search: fallbackKeyword,
            size: 12,
            sort: "startDatetime,asc",
          });
          upcoming = getUpcomingSuggestions(fallbackPage.content, keyword);
        }

        if (!cancelled) setSearchSuggestions(upcoming);
      } catch {
        if (!cancelled) setSearchSuggestions([]);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchTerm]);

  const shouldShowSearchSuggestions =
    isSearchFocused && searchTerm.trim().length >= 2 && searchSuggestions.length > 0;

  return (
    <>
    <nav className="navbar">
      <div className="container nav-container">
        <div className="nav-left">
          <Link
            to="/"
            className="logo"
            style={{ transition: "none" }}
          >
            <span className="logo-flash">Flash</span>
            <span className="logo-ticket">Ticket</span>
          </Link>
        </div>

        <div className="nav-center">
          <form
            className="search-bar"
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              const searchStr = searchTerm.trim();

              if (searchStr) {
                window.location.href = `/search?search=${encodeURIComponent(searchStr)}`;
              } else {
                window.location.href = "/search";
              }
            }}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => window.setTimeout(() => setIsSearchFocused(false), 150)}
          >
            <input
              name="search"
              type="text"
              className="search-input"
              placeholder="Search..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <button type="submit" className="search-submit" aria-label="Search">
              <Search className="search-icon" size={18} />
            </button>

            {shouldShowSearchSuggestions ? (
              <div className="search-suggestion-dropdown">
                {searchSuggestions.map((event) => (
                  <div className="search-suggestion-item" key={event.id}>
                    <Link
                      to={`/event/${event.slug || event.id}`}
                      className="search-suggestion-main"
                    >
                      <img
                        src={getSuggestionImage(event)}
                        alt={event.title}
                        className="search-suggestion-thumb"
                      />
                      <span className="search-suggestion-copy">
                        <strong>{event.title}</strong>
                        <small>{formatSuggestionDate(event)}</small>
                      </span>
                    </Link>
                    <Link
                      to={`/event/${event.slug || event.id}`}
                      className="search-suggestion-view"
                    >
                      View
                    </Link>
                  </div>
                ))}

                <Link
                  to={`/search?search=${encodeURIComponent(searchTerm.trim())}`}
                  className="search-suggestion-more"
                >
                  Xem thêm sự kiện
                </Link>
              </div>
            ) : null}
          </form>

          <div className="nav-prompt-dropdown">
            <button type="button" className="nav-prompt-trigger">
              <span>{defaultQuickPrompt}</span>
              <ChevronDown size={15} />
            </button>
            <div className="nav-prompt-menu">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="nav-prompt-item"
                  onClick={() => handleQuickPrompt(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="nav-right nav-actions">
          <Link
            to="/my-tickets"
            className="nav-quick-link"
            onClick={(event) => {
              if (isAuthenticated) return;
              event.preventDefault();
              requireLogin();
            }}
          >
            <HiTicket size={20} />
            <span>
              <strong>Tickets</strong>
              <small>My Tickets</small>
            </span>
          </Link>

          <Link
            to="/my-orders"
            className="nav-quick-link"
            onClick={(event) => {
              if (isAuthenticated) return;
              event.preventDefault();
              requireLogin();
            }}
          >
            <RiShoppingBag3Fill size={20} />
            <span>
              <strong>Orders</strong>
              <small>History</small>
            </span>
          </Link>

          {!initialized ? (
            <div style={{ width: 120, height: 40 }} aria-hidden="true" />
          ) : !isAuthenticated ? (
            <>
              <button
                type="button"
                className="nav-quick-link nav-auth-trigger"
                onClick={() => setShowAuthPopup(true)}
                aria-haspopup="dialog"
                aria-expanded={showAuthPopup}
              >
                <RiAccountCircleFill size={20} />
                <span>
                  <strong>Sign In</strong>
                  <small>Account</small>
                </span>
              </button>
            </>
          ) : (
            <div className="account-dropdown">
              <div className="account-trigger">
                <img
                  src={avatarSrc}
                  alt={accountName}
                  className="nav-avatar"
                  onError={() => setAvatarBroken(true)}
                />
                <span className="nav-account-label">{accountName}</span>
                <ChevronDown className="account-trigger-chevron" size={16} />
              </div>

              <div className="dropdown-menu">
                <Link to="/profile" className="dropdown-item">
                  <UserRound size={17} />
                  Hồ sơ cá nhân
                </Link>
                {!isOrganizerWorkspace ? (
                  <>
                    <Link to="/my-tickets" className="dropdown-item">
                      <HiTicket size={17} />
                      Vé của tôi
                    </Link>
                    <Link to="/my-orders" className="dropdown-item">
                      <ShoppingBag size={17} />
                      Đơn hàng của tôi
                    </Link>
                  </>
                ) : null}
                {isOrganizer ? (
                  <Link to="/organizer" className="dropdown-item">
                    <LayoutDashboard size={17} />
                    Quản lý sự kiện
                  </Link>
                ) : hasOrganizerApplication ? (
                  <div className="dropdown-item dropdown-item-muted">
                    <Clock3 size={17} />
                    Hồ sơ organizer đang chờ duyệt
                  </div>
                ) : (
                  <Link to="/organizers/apply" className="dropdown-item">
                    <UserPlus size={17} />
                    Đăng ký nhà tổ chức
                  </Link>
                )}
                {isAdmin ? (
                  <Link to="/admin/organizers" className="dropdown-item">
                    <LayoutDashboard size={17} />
                    Duyệt hồ sơ organizer
                  </Link>
                ) : null}
                {canEditHomePage ? (
                  <Link to="/?editHome=1" className="dropdown-item">
                    <Home size={17} />
                    Sửa giao diện trang chủ
                  </Link>
                ) : null}
                <hr />
                <button
                  onClick={() => void handleLogout()}
                  className="dropdown-item logout w-full text-left"
                >
                  <LogOut size={17} />
                  Đăng xuất
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
    {showAuthPopup && !isAuthenticated ? (
      <div
        className="auth-popup-backdrop"
        role="presentation"
        onClick={() => setShowAuthPopup(false)}
      >
        <div
          className="auth-popup-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-popup-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="auth-popup-header">
            <button
              type="button"
              className="auth-popup-close"
              aria-label="Close sign in popup"
              onClick={() => setShowAuthPopup(false)}
            >
              <X size={18} />
            </button>
            <div className="auth-popup-user-icon" aria-hidden="true">
              <UserRound size={32} />
            </div>
            <h2 id="auth-popup-title">Welcome back</h2>
            <p>Sign in to continue booking tickets and manage your orders</p>
          </div>

          <div className="auth-popup-body">
            <button
              type="button"
              className="auth-popup-button auth-popup-button-primary"
              onClick={handleLogin}
            >
              <LogIn size={18} />
              Sign in
            </button>
            <button
              type="button"
              className="auth-popup-button auth-popup-button-secondary"
              onClick={handleRegister}
            >
              <UserPlus size={18} />
              Create account
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
};

export default Navbar;
