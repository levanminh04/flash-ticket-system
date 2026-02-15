import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  CalendarDays,
  Ticket,
  LogOut,
  Ticket as TicketIcon,
  Bell,
  CircleChevronLeft,
  CircleChevronRight,
} from "lucide-react";
import { useKeycloak } from "@react-keycloak/web";

const sidebarLinks = [
  {
    name: "Tổng quan",
    path: "/admin",
    icon: <LayoutDashboard size={20} />,
    exact: true,
  },
  { name: "Quản lý User", path: "/admin/users", icon: <Users size={20} /> },
  {
    name: "Duyệt Ban Tổ chức",
    path: "/admin/organizers",
    icon: <UserCheck size={20} />,
  },
  {
    name: "Quản lý Sự kiện",
    path: "/admin/events",
    icon: <CalendarDays size={20} />,
  },
  {
    name: "Quản lý Đơn hàng",
    path: "/admin/orders",
    icon: <Ticket size={20} />,
  },
];

export default function AdminLayout() {
  const { keycloak } = useKeycloak();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden">
      <aside
        className={`${isCollapsed ? "w-20" : "w-68"} bg-white text-slate-500 border-r border-[#E5E7EB] flex flex-col shrink-0 transition-all duration-300 shadow-xl z-20 relative`}
      >
        <div
          className={`h-16 flex items-center ${isCollapsed ? "justify-center px-0" : "justify-between px-6 gap-4"} border-b border-[#2dc275] bg-[#2dc275] transition-all duration-300`}
        >
          {isCollapsed ? (
            <button
              onClick={() => setIsCollapsed(false)}
              className="text-white hover:text-slate-100 transition-colors"
            >
              <CircleChevronRight size={28} />
            </button>
          ) : (
            <>
              <span className="text-white text-xl font-bold tracking-tight whitespace-nowrap overflow-hidden">
                Flash Ticket System
              </span>
              <button
                onClick={() => setIsCollapsed(true)}
                className="text-white hover:text-slate-100 transition-colors"
              >
                <CircleChevronLeft size={24} />
              </button>
            </>
          )}
        </div>
        <div className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto no-scrollbar">
          {sidebarLinks.map((link) => (
            <NavLink
              key={link.name}
              to={link.path}
              end={link.exact}
              className={({ isActive }) =>
                `flex items-center ${isCollapsed ? "justify-center px-0" : "px-3 gap-3"} py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-[#EAF8F0] text-[#2dc275] font-bold shadow-sm"
                    : "text-[#4B5563] hover:bg-gray-50 font-medium"
                }`
              }
            >
              <div className="shrink-0">{link.icon}</div>
              {!isCollapsed && (
                <span className="whitespace-nowrap overflow-hidden">
                  {link.name}
                </span>
              )}
            </NavLink>
          ))}
        </div>
        <div className="p-4 border-t border-gray-100 bg-white">
          <button
            onClick={() =>
              keycloak.logout({ redirectUri: window.location.origin })
            }
            className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} px-3 py-3 w-full rounded-xl font-medium text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors`}
          >
            <div className="shrink-0">
              <LogOut size={20} />
            </div>
            {!isCollapsed && (
              <span className="whitespace-nowrap overflow-hidden">
                Đăng xuất
              </span>
            )}
          </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-10">
          <div></div>

          <div className="flex items-center gap-5">
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#2dc275] to-[#5ce49b] text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover:shadow-md transition-shadow">
                AD
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-700 leading-tight">
                  Admin
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  System Manager
                </span>
              </div>
            </div>
            <button className="text-slate-400 hover:text-[#2dc275] transition-colors relative">
              <Bell size={22} />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto bg-[#f8fafc] relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
