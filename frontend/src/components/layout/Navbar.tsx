// File: src/components/layout/Navbar.tsx
import { useEffect } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Search } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { confirmDestructiveAction } from "../../lib/swal";
import { hasRealmRole } from "../../lib/auth";

const LOGIN_TOAST_KEY = "flashTicket:pendingLoginToast";

const Navbar = () => {
  const { keycloak, initialized } = useKeycloak();
  const location = useLocation();
  const isAuthenticated = initialized && !!keycloak?.authenticated;
  const isOrganizer = hasRealmRole(keycloak?.tokenParsed, "ORGANIZER");
  const isOrganizerWorkspace = isOrganizer && location.pathname.startsWith("/organizer");

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

  useEffect(() => {
    if (!isAuthenticated) return;
    const shouldNotify = sessionStorage.getItem(LOGIN_TOAST_KEY) === "1";
    if (!shouldNotify) return;

    toast.success("Đăng nhập thành công");
    sessionStorage.removeItem(LOGIN_TOAST_KEY);
  }, [isAuthenticated]);

  return (
    <nav className="navbar">
      <div className="container nav-container">
        <div className="nav-left">
          <Link
            to="/"
            className="logo"
            style={{ color: "white", transition: "none" }}
          >
            FlashTicket
          </Link>
        </div>

        <div className="nav-center">
          <form
            className="search-bar"
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const searchStr = formData.get("search");

              if (searchStr) {
                window.location.href = `/search?search=${encodeURIComponent(searchStr.toString())}`;
              } else {
                window.location.href = "/search";
              }
            }}
          >
            <Search className="search-icon" size={20} />
            <input
              name="search"
              type="text"
              className="search-input"
              placeholder="Tìm sự kiện, nghệ sĩ, địa điểm"
            />
          </form>
        </div>

        <div className="nav-right nav-actions">
          {!initialized ? (
            <div style={{ width: 120, height: 40 }} aria-hidden="true" />
          ) : !isAuthenticated ? (
            <>
              <button
                onClick={() => keycloak?.register()}
                className="btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  boxShadow: "none",
                  color: "white",
                }}
              >
                Đăng ký
              </button>

              <button
                onClick={() => {
                  sessionStorage.setItem(LOGIN_TOAST_KEY, "1");
                  keycloak?.login();
                }}
                className="btn btn-outline"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                Đăng nhập
              </button>
            </>
          ) : (
            <div className="account-dropdown">
              <div className="account-trigger">
                <img
                  src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                  alt="Avatar"
                  className="nav-avatar"
                />
                <span className="nav-account-label">
                  {keycloak.tokenParsed?.name ||
                    `${keycloak.tokenParsed?.given_name || ""} ${keycloak.tokenParsed?.family_name || ""}`.trim() ||
                    keycloak.tokenParsed?.preferred_username ||
                    "User"}
                </span>
                <i className="ph-fill ph-caret-down"></i>
              </div>

              <div className="dropdown-menu">
                <Link to="/profile" className="dropdown-item">
                  Hồ sơ cá nhân
                </Link>
                {!isOrganizerWorkspace ? (
                  <>
                    <Link to="/my-tickets" className="dropdown-item">
                      Vé của tôi
                    </Link>
                    <Link to="/my-orders" className="dropdown-item">
                      Đơn hàng của tôi
                    </Link>
                  </>
                ) : null}
                {isOrganizer ? (
                  <Link to="/organizer" className="dropdown-item">
                    Quản lý sự kiện
                  </Link>
                ) : null}
                <hr />
                <button
                  onClick={() => void handleLogout()}
                  className="dropdown-item logout w-full text-left"
                >
                  Đăng xuất
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
