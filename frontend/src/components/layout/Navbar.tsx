import { useKeycloak } from "@react-keycloak/web";
import { Search } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const Navbar = () => {
  const { keycloak, initialized } = useKeycloak();
  const navigate = useNavigate();

  if (!initialized) {
    return <div className="p-4 text-center">Đang kết nối</div>;
  }

  return (
    <nav className="navbar">
      <div className="container nav-container">
        <div className="nav-left">
          <Link to="/" className="logo">
            FlashTicket
          </Link>
        </div>
        <div className="nav-center">
          <div className="search-bar">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              className="search-input"
              placeholder="Tìm sự kiện, nghệ sĩ, địa điểm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = e.currentTarget.value.trim();
                  if (val) {
                    navigate(`/search?q=${encodeURIComponent(val)}`);
                  } else {
                    navigate("/search");
                  }
                }
              }}
            />
          </div>
        </div>
        <div className="nav-right nav-actions">
          {!keycloak.authenticated ? (
            <>
              <button
                onClick={() => keycloak.login()}
                className="btn btn-outline"
              >
                Đăng nhập
              </button>
              <button
                onClick={() => keycloak.register()}
                className="btn btn-primary"
              >
                Đăng ký
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
                  {keycloak.tokenParsed?.preferred_username || "User"}
                </span>
                <i className="ph-fill ph-caret-down"></i>
              </div>
              <div className="dropdown-menu">
                <Link to="/profile" className="dropdown-item">
                  Hồ sơ cá nhân
                </Link>
                <Link to="/my-tickets" className="dropdown-item">
                  Vé của tôi
                </Link>
                <hr />
                <button
                  onClick={() => keycloak.logout()}
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
