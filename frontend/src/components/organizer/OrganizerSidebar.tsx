import { NavLink } from "react-router-dom";

const navItems: Array<{
  to: string;
  label: string;
  end?: boolean;
}> = [
  {
    to: "/organizer",
    label: "Tổng quan",
    end: true,
  },
  {
    to: "/organizer/events",
    label: "Quản lý sự kiện",
  },
  {
    to: "/organizer/profile",
    label: "Hồ sơ ban tổ chức",
  },
  {
    to: "/organizer/media",
    label: "Thư viện ảnh sự kiện",
  },
  {
    to: "/venues",
    label: "Địa điểm",
  },
  {
    to: "/organizer/check-in",
    label: "Check-in",
  },
];

export default function OrganizerSidebar() {
  return (
    <aside className="organizer-sidebar organizer-category-nav">
      <nav
        className="container organizer-category-nav-track"
        aria-label="Organizer navigation"
      >
        {navItems.map((item) => {
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `organizer-category-link ${isActive ? "active" : ""}`
              }
            >
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
