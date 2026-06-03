import { NavLink } from "react-router-dom";
import { FaUserLarge } from "react-icons/fa6";
import { ImTicket } from "react-icons/im";
import { HiMiniShoppingBag } from "react-icons/hi2";
import { useTranslation } from "react-i18next";

export default function AccountSidebar() {
  const { t } = useTranslation();

  return (
    <aside className="profile-sidebar">
      <h2 className="profile-sidebar-title">{t("account.title")}</h2>
      <nav className="profile-sidebar-nav">
        <NavLink
          to="/profile"
          end
          className={({ isActive }) =>
            `profile-sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <FaUserLarge size={18} />
          <span>{t("nav.personalProfile")}</span>
        </NavLink>

        <NavLink
          to="/my-tickets"
          className={({ isActive }) =>
            `profile-sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <ImTicket size={18} />
          <span>{t("nav.myTickets")}</span>
        </NavLink>

        <NavLink
          to="/my-orders"
          className={({ isActive }) =>
            `profile-sidebar-link ${isActive ? "active" : ""}`
          }
        >
          <HiMiniShoppingBag size={18} />
          <span>{t("nav.myOrders")}</span>
        </NavLink>
      </nav>
    </aside>
  );
}
