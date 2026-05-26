import { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { IconType } from "react-icons";
import { BiSolidCategoryAlt } from "react-icons/bi";
import { AiFillLayout } from "react-icons/ai";
import {
  FaAngleRight,
  FaCalendarAlt,
  FaMapMarkedAlt,
  FaUserAlt,
} from "react-icons/fa";
import { FaCircleInfo, FaMap } from "react-icons/fa6";
import { IoImages, IoQrCodeSharp, IoTicketSharp } from "react-icons/io5";

const eventWorkspaceItems = [
  { label: "Thông tin sự kiện", suffix: "edit", icon: FaCircleInfo },
  { label: "Loại vé", suffix: "ticket-types", icon: IoTicketSharp },
  { label: "Layout", suffix: "layout", icon: AiFillLayout },
  { label: "Seat map", suffix: "seat-map", icon: FaMap },
];

const navItems: Array<{
  to: string;
  label: string;
  description: string;
  icon: IconType;
  end?: boolean;
  hasEventChildren?: boolean;
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
    hasEventChildren: true,
  },
  {
    to: "/organizer/profile",
    label: "Hồ sơ ban tổ chức",
    description: "Profile",
    icon: FaUserAlt,
  },
  {
    to: "/organizer/media",
    label: "Thư viện ảnh",
    description: "Media",
    icon: IoImages,
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

function getEventIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/organizer\/events\/([^/]+)\//);
  return match?.[1] ?? null;
}

export default function OrganizerSidebar({
  isCollapsed,
  onToggle,
}: OrganizerSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isEventMenuOpen, setIsEventMenuOpen] = useState(false);
  const eventId = getEventIdFromPath(location.pathname);

  const eventChildren = useMemo(
    () =>
      eventWorkspaceItems.map((item) => ({
        ...item,
        to: eventId ? `/organizer/events/${eventId}/${item.suffix}` : "",
      })),
    [eventId],
  );

  const renderEventChildren = (variant: "inline" | "flyout") => (
    <div className={`organizer-event-child-menu organizer-event-child-menu-${variant}`}>
      {eventChildren.map((item) => {
        const isDisabled = !item.to;
        const isActive = item.to ? location.pathname === item.to : false;
        const ChildIcon = item.icon;

        return (
          <button
            key={item.suffix}
            type="button"
            className={`organizer-event-child-link ${isActive ? "active" : ""}`}
            disabled={isDisabled}
            title={isDisabled ? "Chọn một sự kiện trước" : item.label}
            onClick={() => {
              if (item.to) navigate(item.to);
            }}
          >
            <ChildIcon size={15} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );

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
          F
        </button>
        <div>
          <h1>
            Flash<span>Organizer</span>
          </h1>
          <p>Event operations</p>
        </div>
      </div>

      <nav className="organizer-sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isEventParentActive =
            item.hasEventChildren &&
            location.pathname.startsWith("/organizer/events");

          if (item.hasEventChildren) {
            return (
              <div
                key={item.to}
                className={`organizer-nav-group ${
                  isEventParentActive ? "active" : ""
                }`}
              >
                <div className="organizer-nav-link-row">
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `organizer-nav-link organizer-nav-link-parent ${
                        isActive || isEventParentActive ? "active" : ""
                      }`
                    }
                  >
                    <Icon size={20} />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </NavLink>

                  {!isCollapsed ? (
                    <button
                      type="button"
                      className={`organizer-event-menu-toggle ${
                        isEventMenuOpen ? "is-open" : ""
                      }`}
                      onClick={() => setIsEventMenuOpen((value) => !value)}
                      aria-label={
                        isEventMenuOpen
                          ? "Thu gọn chức năng sự kiện"
                          : "Mở chức năng sự kiện"
                      }
                      aria-expanded={isEventMenuOpen}
                    >
                      <FaAngleRight size={15} />
                    </button>
                  ) : null}
                </div>

                {!isCollapsed && isEventMenuOpen ? renderEventChildren("inline") : null}
                {isCollapsed ? renderEventChildren("flyout") : null}
              </div>
            );
          }

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
