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
} from "lucide-react";

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

export default function OrganizerManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedKyc, setSelectedKyc] = useState<any | null>(null);

  const renderKycTable = () => (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-[13px] tracking-wider">
            <th className="px-6 py-4 font-bold">Ban tổ chức</th>
            <th className="px-6 py-4 font-bold">Mã số thuế</th>
            <th className="px-6 py-4 font-bold">Người đại diện</th>
            <th className="px-6 py-4 font-bold">Căn cước công dân</th>
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
          Duyệt ban tổ chức
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Quản lý và xét duyệt hồ sơ đăng ký của ban tổ chức sự kiện
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
            placeholder="Tìm mã số thuế, tên công ty"
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2dc275] shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
          <Filter size={18} /> Lọc trạng thái
        </button>
      </div>

      {renderKycTable()}

      {selectedKyc && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Shield className="text-[#2dc275]" /> Xét duyệt hồ sơ ban tổ
                chức
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
