import { useState } from "react";
import {
  Search,
  Filter,
  Shield,
  User,
  CheckCircle2,
  Ban,
  Eye,
  Download,
  Building2,
  CreditCard,
  FileText,
  X,
  AlertCircle,
  Clock,
  Edit,
  Trash2,
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
const mockKycRequests = [
  {
    id: "ORG-REQ-01",
    companyName: "Công ty CP Giải trí Á Châu",
    taxCode: "0101234567",
    representative: "Nguyễn Văn A",
    idCard: "001090123456",
    businessLicenseUrl: "https://example.com/license.pdf",
    bankAccount: {
      bankName: "Vietcombank",
      accountName: "CTY CP GIAI TRI A CHAU",
      accountNumber: "10123456789",
    },
    status: "PENDING",
    submittedAt: "15/02/2026 14:30",
  },
  {
    id: "ORG-REQ-02",
    companyName: "Lune Production",
    taxCode: "0311987654",
    representative: "Trần Thị B",
    idCard: "079182345678",
    businessLicenseUrl: "https://example.com/license2.pdf",
    bankAccount: {
      bankName: "Techcombank",
      accountName: "LUNE PRODUCTION",
      accountNumber: "19033334444",
    },
    status: "APPROVED",
    submittedAt: "10/02/2026 09:15",
  },
];

export default function UserManagement() {
  const [activeTab, setActiveTab] = useState<"USERS" | "KYC">("USERS");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedKyc, setSelectedKyc] = useState<any | null>(null);
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
  const renderKycTable = () => (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-[13px] tracking-wider">
            <th className="px-6 py-4 font-bold">Ban tổ chức</th>
            <th className="px-6 py-4 font-bold">Mã số thuế</th>
            <th className="px-6 py-4 font-bold">Người đại diện</th>
            <th className="px-6 py-4 font-bold">CCCD</th>
            <th className="px-6 py-4 font-bold">Ngày gửi</th>
            <th className="px-6 py-4 font-bold">Trạng thái duyệt</th>
            <th className="px-6 py-4 font-bold text-center">Hồ sơ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {mockKycRequests.map((req) => (
            <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
              <td className="px-6 py-4">
                <div className="text-slate-700">{req.companyName}</div>
              </td>
              <td className="px-6 py-4 text-slate-700">{req.taxCode}</td>
              <td className="px-6 py-4">
                <div className="text-slate-700">{req.representative}</div>
              </td>
              <td className="px-6 py-4 text-slate-700">{req.idCard}</td>
              <td className="px-6 py-4 text-slate-600 font-medium">
                {req.submittedAt}
              </td>
              <td className="px-6 py-4">
                {req.status === "PENDING" && (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-md text-xs font-bold">
                    Chờ duyệt
                  </span>
                )}
                {req.status === "APPROVED" && (
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold">
                    Đã duyệt
                  </span>
                )}
                {req.status === "REJECTED" && (
                  <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold">
                    Từ chối
                  </span>
                )}
              </td>
              <td className="px-6 py-4 text-center">
                <button
                  onClick={() => setSelectedKyc(req)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md text-xs font-bold transition-colors"
                >
                  <Eye size={14} /> Xem chi tiết
                </button>
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
          Quản lý định danh và người dùng
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Hệ thống phân quyền khách hàng và xét duyệt ban tổ chức sự kiện (KYC)
        </p>
      </div>

      {/* CUSTOM TABS */}
      <div className="flex items-center border-b border-slate-200 gap-8">
        <button
          onClick={() => setActiveTab("USERS")}
          className={`pb-4 font-bold text-sm flex items-center gap-2 transition-colors relative ${activeTab === "USERS" ? "text-[#2dc275]" : "text-slate-500 hover:text-slate-800"}`}
        >
          <Users size={18} /> Danh sách người dùng
          {activeTab === "USERS" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#2dc275] rounded-t-full"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("KYC")}
          className={`pb-4 font-bold text-sm flex items-center gap-2 transition-colors relative ${activeTab === "KYC" ? "text-[#2dc275]" : "text-slate-500 hover:text-slate-800"}`}
        >
          <Shield size={18} /> Duyệt ban tổ chức (KYC)
          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] ml-1">
            1 Chờ duyệt
          </span>
          {activeTab === "KYC" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#2dc275] rounded-t-full"></span>
          )}
        </button>
      </div>
      <div className="mt-6 flex items-center gap-4">
        <div className="relative w-full max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="text"
            placeholder={
              activeTab === "USERS"
                ? "Tìm theo tên, email user"
                : "Tìm mã số thuế, tên công ty"
            }
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2dc275] shadow-sm"
          />
        </div>
      </div>
      {activeTab === "USERS" ? renderUsersTable() : renderKycTable()}
      {selectedKyc && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Shield className="text-[#2dc275]" /> Xét duyệt hồ sơ ban tổ
                chức{" "}
              </h3>
              <button
                onClick={() => setSelectedKyc(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-slate-400 tracking-wider mb-1 flex items-center gap-1.5">
                      <Building2 size={14} /> Thông tin doanh nghiệp
                    </p>
                    <p className="font-bold text-slate-900">
                      {selectedKyc.companyName}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      Mã số thuế:{" "}
                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                        {selectedKyc.taxCode}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 tracking-wider mb-1 flex items-center gap-1.5">
                      <User size={14} /> Người đại diện pháp luật
                    </p>
                    <p className="font-bold text-slate-900">
                      {selectedKyc.representative}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      CCCD: {selectedKyc.idCard}
                    </p>
                  </div>
                </div>
                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-xs font-bold text-slate-400 tracking-wider mb-1 flex items-center gap-1.5">
                      <CreditCard size={14} /> Tài khoản nhận tiền vé
                    </p>
                    <p className="font-bold text-blue-600">
                      {selectedKyc.bankAccount.bankName}
                    </p>
                    <p className="text-sm font-mono text-slate-900 font-bold mt-1">
                      {selectedKyc.bankAccount.accountNumber}
                    </p>
                    <p className="text-xs text-slate-500 uppercase mt-0.5">
                      {selectedKyc.bankAccount.accountName}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 tracking-wider mb-3 flex items-center gap-1.5">
                  <FileText size={14} /> Tài liệu xác minh
                </p>
                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 text-red-500 rounded flex items-center justify-center font-bold text-xs">
                      PDF
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700">
                        GPKD_{selectedKyc.taxCode}.pdf
                      </p>
                      <p className="text-xs text-slate-400">2.4 MB</p>
                    </div>
                  </div>
                  <button
                    className="text-blue-600 hover:bg-blue-50 p-2 rounded transition-colors"
                    title="Tải xuống"
                  >
                    <Download size={18} />
                  </button>
                </div>
              </div>
            </div>
            {selectedKyc.status === "PENDING" && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button className="px-6 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors shadow-sm flex items-center gap-2">
                  <Ban size={18} /> Từ chối
                </button>
                <button className="px-6 py-2 bg-[#2dc275] text-white font-bold rounded-lg hover:bg-[#24a161] transition-colors shadow-sm flex items-center gap-2">
                  <CheckCircle2 size={18} /> Phê duyệt
                </button>
              </div>
            )}
            {selectedKyc.status !== "PENDING" && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <span
                  className={`font-bold text-sm flex items-center gap-1.5 ${selectedKyc.status === "APPROVED" ? "text-emerald-600" : "text-red-600"}`}
                >
                  {selectedKyc.status === "APPROVED" ? (
                    <>
                      <CheckCircle2 size={18} /> Hồ sơ đã được duyệt
                    </>
                  ) : (
                    <>
                      <Ban size={18} /> Hồ sơ đã bị từ chối
                    </>
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Bổ sung icon import bị thiếu
function Users({ size, className }: { size?: number; className?: string }) {
  return <User size={size} className={className} />;
}
