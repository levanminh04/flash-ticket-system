import { NavLink } from "react-router-dom";
import { UserRound, Ticket, ShoppingBag } from "lucide-react";

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
          <UserRound size={18} />
          <span>Hồ sơ cá nhân</span>
        </NavLink>

        <NavLink
          to="/my-tickets"
          className={({ isActive }) =>
            `profile-sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <Ticket size={18} />
          <span>Vé của tôi</span>
        </NavLink>

        <NavLink
          to="/my-orders"
          className={({ isActive }) =>
            `profile-sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <ShoppingBag size={18} />
          <span>Đơn hàng của tôi</span>
        </NavLink>
      </nav>
    </aside>
  );
}
