import { NavLink, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, Users, UserCheck, CalendarDays, 
  Ticket, LogOut, Ticket as TicketIcon, Bell
} from 'lucide-react';
import { useKeycloak } from '@react-keycloak/web';

const sidebarLinks = [
  { name: 'Tổng quan', path: '/admin', icon: <LayoutDashboard size={20} />, exact: true },
  { name: 'Quản lý User', path: '/admin/users', icon: <Users size={20} /> },
  { name: 'Duyệt Ban Tổ chức', path: '/admin/organizers', icon: <UserCheck size={20} /> },
  { name: 'Quản lý Sự kiện', path: '/admin/events', icon: <CalendarDays size={20} /> },
  { name: 'Quản lý Đơn hàng', path: '/admin/orders', icon: <Ticket size={20} /> },
];

export default function AdminLayout() {
  const { keycloak } = useKeycloak();

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden">
      
      {/* SIDEBAR (Cột trái) */}
      <aside className="w-64 bg-[#0f172a] text-slate-300 flex flex-col shrink-0 transition-all shadow-xl z-20">
        {/* Admin Logo */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 bg-[#0b1120]">
          <span className="text-white text-xl font-black tracking-tight">Flash Admin</span>
        </div>

        {/* Menu Navigation */}
        <div className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto no-scrollbar">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4 px-2">
            Menu chính
          </div>
          {sidebarLinks.map((link) => (
            <NavLink
              key={link.name}
              to={link.path}
              end={link.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 ${
                  isActive 
                    ? 'bg-[#2dc275]/15 text-[#2dc275] font-bold shadow-sm' 
                    : 'hover:bg-slate-800 hover:text-white font-medium'
                }`
              }
            >
              {link.icon}
              {link.name}
            </NavLink>
          ))}
        </div>

        {/* Logout Button */}
        <div className="p-4 border-t border-slate-800 bg-[#0b1120]">
          <button 
            onClick={() => keycloak.logout({ redirectUri: window.location.origin })}
            className="flex items-center gap-3 px-3 py-3 w-full rounded-xl font-medium text-slate-400 hover:bg-slate-800 hover:text-red-400 transition-colors"
          >
            <LogOut size={20} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT (Khu vực bên phải) */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Admin Header (Thanh trên cùng) */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-10">
          <h2 className="font-bold text-slate-800 text-lg">Hệ thống quản trị viên</h2>
          
          <div className="flex items-center gap-5">
            <button className="text-slate-400 hover:text-[#2dc275] transition-colors relative">
              <Bell size={22} />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="flex items-center gap-3 border-l border-slate-200 pl-5 cursor-pointer group">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#2dc275] to-[#5ce49b] text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover:shadow-md transition-shadow">
                AD
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-700 leading-tight">Admin</span>
                <span className="text-[11px] text-slate-500 font-medium">System Manager</span>
              </div>
            </div>
          </div>
        </header>

        {/* Nội dung động (Render Dashboard hoặc các trang quản lý vào đây) */}
        <div className="flex-1 overflow-y-auto bg-[#f8fafc] relative">
          <Outlet />
        </div>
      </main>

    </div>
  );
}