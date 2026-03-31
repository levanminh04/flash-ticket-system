import { NavLink } from "react-router-dom";

type OrganizerEventWorkspaceNavProps = {
  eventId: string;
};

const navItems = [
  { label: "Thông tin sự kiện", suffix: "edit" },
  { label: "Loại vé", suffix: "ticket-types" },
  { label: "Layout", suffix: "layout" },
  { label: "Seat map", suffix: "seat-map" },
];

export default function OrganizerEventWorkspaceNav({
  eventId,
}: OrganizerEventWorkspaceNavProps) {
  return (
    <nav className="organizer-subnav">
      {navItems.map((item) => (
        <NavLink
          key={item.suffix}
          to={`/organizer/events/${eventId}/${item.suffix}`}
          className={({ isActive }) =>
            `organizer-subnav-link ${isActive ? "active" : ""}`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
