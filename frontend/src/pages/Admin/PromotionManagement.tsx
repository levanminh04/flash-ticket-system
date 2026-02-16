import { useState } from "react";
import {
  Search,
  Plus,
  Tag,
  Activity,
  Percent,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  Ban,
  X,
  Eye,
  Users,
  Receipt,
} from "lucide-react";

// ==========================================
// MOCK DATA (Dựa trên promotion_schema)
// ==========================================
const mockPromotions = [
  {
    id: "PRM-001",
    code: "SUMMER2026",
    type: "PERCENTAGE",
    value: 20,
    maxDiscount: 100000,
    usageLimit: 500,
    usedCount: 342,
    startDate: "01/06/2026",
    endDate: "30/06/2026",
    status: "ACTIVE",
  },
  {
    id: "PRM-002",
    code: "NEWUSER50K",
    type: "FIXED_AMOUNT",
    value: 50000,
    maxDiscount: null,
    usageLimit: 1000,
    usedCount: 890,
    startDate: "01/01/2026",
    endDate: "31/12/2026",
    status: "ACTIVE",
  },
  {
    id: "PRM-003",
    code: "BLACKFRIDAY",
    type: "PERCENTAGE",
    value: 50,
    maxDiscount: 200000,
    usageLimit: 100,
    usedCount: 0,
    startDate: "27/11/2026",
    endDate: "29/11/2026",
    status: "SCHEDULED",
  },
  {
    id: "PRM-004",
    code: "TETNGUYENDAN",
    type: "FIXED_AMOUNT",
    value: 100000,
    maxDiscount: null,
    usageLimit: 2000,
    usedCount: 2000,
    startDate: "15/01/2026",
    endDate: "15/02/2026",
    status: "EXPIRED",
  },
];

const mockUsages = [
  {
    id: "USE-001",
    promoCode: "SUMMER2026",
    customerName: "Tuyến Phạm",
    customerEmail: "tuyen@example.com",
    orderId: "ORD-20260216-001",
    discountApplied: 100000,
    usedAt: "16/02/2026 10:30",
  },
  {
    id: "USE-002",
    promoCode: "NEWUSER50K",
    customerName: "Minh Lê",
    customerEmail: "minh@example.com",
    orderId: "ORD-20260216-002",
    discountApplied: 50000,
    usedAt: "16/02/2026 11:15",
  },
  {
    id: "USE-003",
    promoCode: "SUMMER2026",
    customerName: "Hải Nguyễn",
    customerEmail: "hai@gmail.com",
    orderId: "ORD-20260215-089",
    discountApplied: 80000,
    usedAt: "15/02/2026 09:00",
  },
];

export default function PromotionManagement() {
  const [activeTab, setActiveTab] = useState<"PROMOTIONS" | "USAGES">(
    "PROMOTIONS",
  );
  const [searchTerm, setSearchTerm] = useState("");

  // State quản lý Form tạo Khuyến mãi
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [discountType, setDiscountType] = useState("PERCENTAGE");

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };
  const renderPromotionsTab = () => (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6 animate-in fade-in">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-[13px] tracking-wider">
            <th className="px-6 py-4 font-bold">Mã code</th>
            <th className="px-6 py-4 font-bold">Mức giảm</th>
            <th className="px-6 py-4 font-bold text-center">
              Đã dùng / Giới hạn
            </th>
            <th className="px-6 py-4 font-bold">Thời gian áp dụng</th>
            <th className="px-6 py-4 font-bold">Trạng Thái</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {mockPromotions.map((promo) => (
            <tr
              key={promo.id}
              className="hover:bg-slate-50/80 transition-colors"
            >
              <td className="px-6 py-4">
                <div className="font-mono font-bold text-lg text-slate-900 bg-slate-100 px-3 py-1 rounded inline-block border border-slate-200 dashed">
                  {promo.code}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  {promo.type === "PERCENTAGE" ? (
                    <>
                      <Percent size={16} className="text-blue-500" /> Giảm{" "}
                      {promo.value}%
                    </>
                  ) : (
                    <>
                      <Banknote size={16} className="text-orange-500" /> Giảm{" "}
                      {formatVND(promo.value)}
                    </>
                  )}
                </div>
                {promo.type === "PERCENTAGE" && promo.maxDiscount && (
                  <div className="text-xs text-slate-500 mt-1">
                    Tối đa: {formatVND(promo.maxDiscount)}
                  </div>
                )}
              </td>
              <td className="px-6 py-4 text-center">
                <div className="flex flex-col items-center">
                  <span className="font-bold text-slate-700">
                    {promo.usedCount}{" "}
                    <span className="text-slate-400 font-normal">
                      / {promo.usageLimit}
                    </span>
                  </span>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden max-w-[100px]">
                    <div
                      className={`h-full rounded-full ${promo.usedCount >= promo.usageLimit ? "bg-red-500" : "bg-[#2dc275]"}`}
                      style={{
                        width: `${(promo.usedCount / promo.usageLimit) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-xs text-slate-600 flex items-center gap-1.5 mb-1">
                  <Calendar size={12} /> {promo.startDate}
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  Đến {promo.endDate}
                </div>
              </td>
              <td className="px-6 py-4">
                {promo.status === "ACTIVE" && (
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold flex w-max items-center gap-1">
                    <CheckCircle2 size={14} /> Đang chạy
                  </span>
                )}
                {promo.status === "SCHEDULED" && (
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold flex w-max items-center gap-1">
                    <Clock size={14} /> Sắp tới
                  </span>
                )}
                {promo.status === "EXPIRED" && (
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-bold flex w-max items-center gap-1">
                    <Ban size={14} /> Hết hạn
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const renderUsagesTab = () => (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6 animate-in fade-in">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-[13px] tracking-wider">
            <th className="px-6 py-4 font-bold">Mã sử dụng</th>
            <th className="px-6 py-4 font-bold">Khách hàng</th>
            <th className="px-6 py-4 font-bold">Email</th>
            <th className="px-6 py-4 font-bold">Mã đơn hàng</th>
            <th className="px-6 py-4 font-bold text-right"> Số tiền giảm</th>
            <th className="px-6 py-4 font-bold">Thời gian sử dụng</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {mockUsages.map((usage) => (
            <tr
              key={usage.id}
              className="hover:bg-slate-50/80 transition-colors"
            >
              <td className="px-6 py-4">
                <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  {usage.promoCode}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Users size={14} className="text-slate-400" />{" "}
                  {usage.customerName}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-slate-500">
                  {usage.customerEmail}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-slate-700 font-mono flex items-center gap-1.5">
                  <Receipt size={14} className="text-slate-400" />{" "}
                  {usage.orderId}
                </div>
              </td>
              <td className="px-6 py-4 text-right font-bold text-[#2dc275]">
                {formatVND(usage.discountApplied)}
              </td>
              <td className="px-6 py-4 text-slate-500 text-xs font-medium">
                {usage.usedAt}
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
          Quản lý mã khuyến mãi
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Tạo mã giảm giá, cấu hình chiến dịch và theo dõi lịch sử sử dụng
        </p>
      </div>

      {/* CUSTOM TABS */}
      <div className="flex items-center border-b border-slate-200 gap-8">
        <button
          onClick={() => setActiveTab("PROMOTIONS")}
          className={`pb-4 font-bold text-sm flex items-center gap-2 transition-colors relative ${activeTab === "PROMOTIONS" ? "text-[#2dc275]" : "text-slate-500 hover:text-slate-800"}`}
        >
          <Tag size={18} /> Danh sách khuyến mãi
          {activeTab === "PROMOTIONS" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#2dc275] rounded-t-full"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("USAGES")}
          className={`pb-4 font-bold text-sm flex items-center gap-2 transition-colors relative ${activeTab === "USAGES" ? "text-[#2dc275]" : "text-slate-500 hover:text-slate-800"}`}
        >
          <Activity size={18} /> Lịch sử sử dụng
          {activeTab === "USAGES" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#2dc275] rounded-t-full"></span>
          )}
        </button>
      </div>

      {/* TOOLBAR */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="relative w-full max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="text"
            placeholder={
              activeTab === "PROMOTIONS"
                ? "Tìm kiếm khuyến mãi"
                : "Tìm kiếm lịch sử sử dụng"
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2dc275] shadow-sm transition-colors"
          />
        </div>

        {activeTab === "PROMOTIONS" && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-[#2dc275] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#24a161] transition-colors shadow-sm text-sm flex items-center gap-2"
          >
            <Plus size={18} /> Tạo mã khuyến mãi
          </button>
        )}
      </div>

      {activeTab === "PROMOTIONS" ? renderPromotionsTab() : renderUsagesTab()}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Tag className="text-[#2dc275]" /> Tạo Chiến Dịch Khuyến Mãi Mới
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Row 1: Code */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Mã Code (Promo Code) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: SUMMER2026"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#2dc275] font-mono font-bold text-slate-900"
                />
              </div>

              {/* Row 2: Type & Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Loại giảm giá
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#2dc275] text-slate-700"
                  >
                    <option value="PERCENTAGE">Theo phần trăm (%)</option>
                    <option value="FIXED_AMOUNT">
                      Giảm số tiền cố định (VNĐ)
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Giá trị giảm <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder={
                        discountType === "PERCENTAGE" ? "VD: 20" : "VD: 50000"
                      }
                      className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#2dc275]"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      {discountType === "PERCENTAGE" ? "%" : "đ"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 3: Limits */}
              <div className="grid grid-cols-2 gap-4">
                {/* Chỉ hiện Max Discount nếu chọn tính theo Phần trăm */}
                {discountType === "PERCENTAGE" ? (
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">
                      Giảm tối đa (VNĐ)
                    </label>
                    <input
                      type="number"
                      placeholder="VD: 100000"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#2dc275]"
                    />
                  </div>
                ) : (
                  <div></div> // Cột trống để cân layout
                )}

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Giới hạn số lần dùng
                  </label>
                  <input
                    type="number"
                    placeholder="VD: 1000"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#2dc275]"
                  />
                </div>
              </div>

              {/* Row 4: Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Thời gian bắt đầu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#2dc275] text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Thời gian kết thúc <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#2dc275] text-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-5 py-2.5 border border-slate-200 bg-white text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-colors"
              >
                Hủy bỏ
              </button>
              <button className="px-5 py-2.5 bg-[#2dc275] text-white font-bold rounded-xl hover:bg-[#24a161] transition-colors shadow-sm flex items-center gap-2">
                <CheckCircle2 size={18} /> Lưu Khuyến Mãi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
