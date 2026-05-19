import { NavLink } from "react-router-dom";
import { FaUserLarge } from "react-icons/fa6";
import { ImTicket } from "react-icons/im";
import { HiMiniShoppingBag } from "react-icons/hi2";

export default function AccountSidebar() {
  return (
    <aside className="profile-sidebar">
      <h2 className="profile-sidebar-title">Tài khoản</h2>
      <nav className="profile-sidebar-nav">
        <NavLink
          to="/profile"
          end
          className={({ isActive }) =>
            `profile-sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <FaUserLarge size={18} />
          <span>Hồ sơ cá nhân</span>
        </NavLink>

        <NavLink
          to="/my-tickets"
          className={({ isActive }) =>
            `profile-sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <ImTicket size={18} />
          <span>Vé của tôi</span>
        </NavLink>

        <NavLink
          to="/my-orders"
          className={({ isActive }) =>
            `profile-sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <HiMiniShoppingBag size={18} />
          <span>Đơn hàng của tôi</span>
        </NavLink>
      </nav>
    </aside>
  );
}
