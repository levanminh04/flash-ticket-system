import { NavLink } from "react-router-dom";
import { IconType } from "react-icons";
import { BiSolidCategoryAlt } from "react-icons/bi";
import {
  FaCalendarAlt,
  FaMapMarkedAlt,
  FaUserAlt,
} from "react-icons/fa";
import { IoQrCodeSharp } from "react-icons/io5";

const navItems: Array<{
  to: string;
  label: string;
  description: string;
  icon: IconType;
  end?: boolean;
}> = [
  {
    to: "/organizer",
    label: "Tổng quan",
    description: "Dashboard",
    icon: BiSolidCategoryAlt,
    end: true,
  },
  {
    to: "/organizer/events",
    label: "Quản lý sự kiện",
    description: "Events",
    icon: FaCalendarAlt,
  },
  {
    to: "/organizer/profile",
    label: "Hồ sơ ban tổ chức",
    description: "Profile",
    icon: FaUserAlt,
  },
  {
    to: "/venues",
    label: "Địa điểm",
    description: "Venues",
    icon: FaMapMarkedAlt,
  },
  {
    to: "/organizer/check-in",
    label: "Check-in",
    description: "QR scanner",
    icon: IoQrCodeSharp,
  },
];

type OrganizerSidebarProps = {
  isCollapsed: boolean;
  onToggle: () => void;
};

export default function OrganizerSidebar({
  isCollapsed,
  onToggle,
}: OrganizerSidebarProps) {
  return (
    <aside
      className={`organizer-sidebar ${isCollapsed ? "is-collapsed" : ""}`}
      aria-label="Organizer navigation"
    >
      <div className="organizer-sidebar-brand">
        <button
          type="button"
          className="organizer-sidebar-logo"
          onClick={onToggle}
          aria-label={isCollapsed ? "Mở sidebar" : "Đóng sidebar"}
          title={isCollapsed ? "Mở sidebar" : "Đóng sidebar"}
        >
          O
        </button>
        <div>
          <h1>
            Organizer
          </h1>
          <p>Event operations</p>
        </div>
      </div>

      <nav className="organizer-sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `organizer-nav-link ${isActive ? "active" : ""}`
              }
            >
              <Icon size={20} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
