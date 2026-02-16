import { useState } from "react";
import {
  Search,
  Shield,
  User,
  CheckCircle2,
  Ban,
  Eye,
  Clock,
  Edit,
  Trash2,
  AlertCircle,
} from "lucide-react";

const mockUsers = [
  {
    id: "USR-001",
    name: "Tuyến Phạm",
    email: "tuyen@example.com",
    phone: "0987654321",
    role: "ADMIN",
    status: "ACTIVE",
    lastActive: "Vừa xong",
    avatar:
      "https://ui-avatars.com/api/?name=Tuyen+Pham&background=2dc275&color=fff",
  },
  {
    id: "USR-002",
    name: "Minh Lê",
    email: "minh@example.com",
    phone: "0912345678",
    role: "ORGANIZER",
    status: "ACTIVE",
    lastActive: "2 giờ trước",
    avatar:
      "https://ui-avatars.com/api/?name=Minh+Le&background=3b82f6&color=fff",
  },
  {
    id: "USR-003",
    name: "Hải Nguyễn",
    email: "hai@gmail.com",
    phone: "0909090909",
    role: "USER",
    status: "INACTIVE",
    lastActive: "3 ngày trước",
    avatar:
      "https://ui-avatars.com/api/?name=Hai+Nguyen&background=cbd5e1&color=fff",
  },
  {
    id: "USR-004",
    name: "Lan Trần",
    email: "lan@company.vn",
    phone: "0888888888",
    role: "USER",
    status: "BANNED",
    lastActive: "1 tuần trước",
    avatar:
      "https://ui-avatars.com/api/?name=Lan+Tran&background=ef4444&color=fff",
  },
];

export default function UserManagement() {
  const [searchTerm, setSearchTerm] = useState("");

  const renderRoleBadge = (role: string) => {
    switch (role) {
      case "ADMIN":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 text-xs font-bold w-max">
            <Shield size={14} /> ADMIN
          </span>
        );
      case "ORGANIZER":
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-100 text-blue-700 text-xs font-bold w-max">
            <User size={14} /> ORGANIZER
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-bold w-max">
            <User size={14} /> USER
          </span>
        );
    }
  };

  const renderUsersTable = () => (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-[13px] tracking-wider">
            <th className="px-6 py-4 font-bold">Tên người dùng</th>
            <th className="px-6 py-4 font-bold">Email liên hệ</th>
            <th className="px-6 py-4 font-bold">Số điện thoại</th>
            <th className="px-6 py-4 font-bold">Vai trò</th>
            <th className="px-6 py-4 font-bold">Trạng thái</th>
            <th className="px-6 py-4 font-bold">Hoạt động cuối</th>
            <th className="px-6 py-4 font-bold text-center">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {mockUsers.map((user) => (
            <tr
              key={user.id}
              className="hover:bg-slate-50/80 transition-colors group"
            >
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <img
                    src={user.avatar}
                    alt="avatar"
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <div className="text-slate-700">{user.name}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-slate-700">{user.email}</td>
              <td className="px-6 py-4 text-slate-700">{user.phone}</td>
              <td className="px-6 py-4">{renderRoleBadge(user.role)}</td>
              <td className="px-6 py-4">
                {user.status === "ACTIVE" && (
                  <span className="flex items-center gap-1 text-[#2dc275] font-semibold">
                    <CheckCircle2 size={16} /> Hoạt động
                  </span>
                )}
                {user.status === "INACTIVE" && (
                  <span className="flex items-center gap-1 text-slate-400 font-semibold">
                    <AlertCircle size={16} /> Chưa XN
                  </span>
                )}
                {user.status === "BANNED" && (
                  <span className="flex items-center gap-1 text-red-500 font-semibold">
                    <Ban size={16} /> Đã Khóa
                  </span>
                )}
              </td>
              <td className="px-6 py-4 text-slate-500 font-medium flex items-center gap-1.5">
                <Clock size={14} className="mt-0.5" /> {user.lastActive}
              </td>
              <td className="px-6 py-4 text-center">
                <div className="flex items-center justify-center gap-3">
                  <button
                    className="text-blue-500 hover:text-blue-600 transition-colors"
                    title="Xem chi tiết"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    className="text-amber-500 hover:text-amber-600 transition-colors"
                    title="Chỉnh sửa"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    className={`transition-colors ${
                      user.status === "BANNED"
                        ? "text-emerald-600 hover:text-emerald-700"
                        : "text-red-500 hover:text-red-600"
                    }`}
                    title={
                      user.status === "BANNED" ? "Mở khóa" : "Khóa tài khoản"
                    }
                  >
                    {user.status === "BANNED" ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <Ban size={18} />
                    )}
                  </button>
                  <button
                    className="text-slate-600 hover:text-slate-800 transition-colors"
                    title="Xóa"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 bg-[#f8fafc] min-h-screen relative">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Quản lý người dùng
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Quản lý thông tin và phân quyền người dùng trong hệ thống
        </p>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <div className="relative w-full max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Tìm theo tên, email"
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2dc275] shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      {renderUsersTable()}
    </div>
  );
}
