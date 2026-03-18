import { NavLink } from "react-router-dom";
import { ImagePlus, LayoutDashboard, QrCode, ShieldCheck } from "lucide-react";

export default function OrganizerSidebar() {
  return (
    <aside className="organizer-sidebar">
      <nav className="organizer-sidebar-nav">
        <NavLink
          to="/organizer"
          end
          className={({ isActive }) =>
            `organizer-nav-link ${isActive ? "active" : ""}`
          }
        >
          <LayoutDashboard size={18} />
          <span>Tổng quan</span>
        </NavLink>

        <NavLink
          to="/organizer/profile"
          className={({ isActive }) =>
            `organizer-nav-link ${isActive ? "active" : ""}`
          }
        >
          <ShieldCheck size={18} />
          <span>Hồ sơ organizer</span>
        </NavLink>

        <NavLink
          to="/organizer/media"
          className={({ isActive }) =>
            `organizer-nav-link ${isActive ? "active" : ""}`
          }
        >
          <ImagePlus size={18} />
          <span>Thư viện ảnh</span>
        </NavLink>

        <NavLink
          to="/organizer/check-in"
          className={({ isActive }) =>
            `organizer-nav-link ${isActive ? "active" : ""}`
          }
        >
          <QrCode size={18} />
          <span>Check-in vé</span>
        </NavLink>
      </nav>
    </aside>
  );
}
