import { useState } from "react";
import {
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  MapPin,
  Grid,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Ban,
  Map,
  Eye,
  Power,
  List,
  Music,
  Trophy,
  BookText,
  Palette,
} from "lucide-react";

const mockEvents = [
  {
    id: "EVT-101",
    title: "Anh Trai Vượt Ngàn Chông Gai Concert",
    organizer: "Lune Production",
    category: "Âm nhạc",
    status: "PUBLISHED",
    isFeatured: true,
    ticketSold: "12,500/15,000",
  },
  {
    id: "EVT-102",
    title: "Giải bóng đá V-League 2026",
    organizer: "VPF",
    category: "Thể thao",
    status: "PUBLISHED",
    isFeatured: false,
    ticketSold: "4,200/10,000",
  },
  {
    id: "EVT-103",
    title: "Hội thảo AI & Tương lai",
    organizer: "TechTalk VN",
    category: "Hội thảo",
    status: "PENDING_REVIEW",
    isFeatured: false,
    ticketSold: "0/500",
  },
  {
    id: "EVT-104",
    title: "Show Hài Độc Thoại: Cười Xuyên Việt",
    organizer: "Comedy Club",
    category: "Nghệ thuật",
    status: "FORCE_CANCELLED",
    isFeatured: false,
    ticketSold: "120/800",
  },
];

const mockVenues = [
  {
    id: "VN-01",
    name: "Sân Vận Động Mỹ Đình",
    location: "Đường Lê Đức Thọ, Nam Từ Liêm, Hà Nội",
    capacity: 40000,
    sectors: 24,
    status: "ACTIVE",
  },
  {
    id: "VN-02",
    name: "Nhà Hát Hòa Bình",
    location: "240 Đường 3 Tháng 2, Quận 10, TP.HCM",
    capacity: 2500,
    sectors: 4,
    status: "ACTIVE",
  },
  {
    id: "VN-03",
    name: "Trung Tâm Hội Nghị Quốc Gia",
    location: "Phạm Hùng, Nam Từ Liêm, Hà Nội",
    capacity: 3800,
    sectors: 6,
    status: "MAINTENANCE",
  },
];

const mockCategories = [
  {
    id: "CAT-1",
    name: "Âm nhạc",
    description: "Các sự kiện hòa nhạc, liveshow, festival",
    eventCount: 145,
  },
  {
    id: "CAT-2",
    name: "Thể thao",
    description: "Bóng đá, eSports, giải chạy",
    eventCount: 84,
  },
  {
    id: "CAT-3",
    name: "Hội thảo",
    description: "Workshop, talkshow chuyên ngành",
    eventCount: 210,
  },
  {
    id: "CAT-4",
    name: "Nghệ thuật",
    description: "Kịch nói, múa rối, triển lãm tranh...",
    eventCount: 56,
  },
];

export default function EventManagement() {
  const [activeTab, setActiveTab] = useState<
    "EVENTS" | "VENUES" | "CATEGORIES"
  >("EVENTS");
  const [events, setEvents] = useState(mockEvents);
  const [searchTerm, setSearchTerm] = useState("");

  const toggleFeatured = (id: string) => {
    setEvents((prev) =>
      prev.map((event) =>
        event.id === id ? { ...event, isFeatured: !event.isFeatured } : event,
      ),
    );
  };
  const ToggleSwitch = ({
    isOn,
    onClick,
  }: {
    isOn: boolean;
    onClick: () => void;
  }) => (
    <div
      onClick={onClick}
      className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${isOn ? "bg-[#2dc275]" : "bg-slate-300"}`}
    >
      <div
        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${isOn ? "translate-x-5" : "translate-x-0"}`}
      ></div>
    </div>
  );
  const renderEventsTab = () => (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6 animate-in fade-in duration-300">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-[13px] tracking-wider">
            <th className="px-6 py-4 font-bold">Tên sự kiện</th>
            <th className="px-6 py-4 font-bold">Mã sự kiện</th>
            <th className="px-6 py-4 font-bold">Ban tổ chức</th>
            <th className="px-6 py-4 font-bold text-center">Slider</th>
            <th className="px-6 py-4 font-bold">Trạng thái</th>
            <th className="px-6 py-4 font-bold text-center">Kiểm duyệt</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {events.map((event) => (
            <tr
              key={event.id}
              className="hover:bg-slate-50/80 transition-colors group"
            >
              <td className="px-6 py-4">
                <div className="font-bold text-slate-900 line-clamp-1">
                  {event.title}
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-white text-[10px] font-bold ${
                      event.category === "Âm nhạc"
                        ? "bg-purple-500"
                        : event.category === "Thể thao"
                          ? "bg-blue-500"
                          : event.category === "Hội thảo"
                            ? "bg-amber-500"
                            : event.category === "Nghệ thuật"
                              ? "bg-rose-500"
                              : "bg-slate-500"
                    }`}
                  >
                    {event.category}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 font-mono text-slate-500 font-bold">
                {event.id}
              </td>
              <td className="px-6 py-4 font-medium text-slate-700">
                {event.organizer}
              </td>

              {/* Nút Toggle is_featured */}
              <td className="px-6 py-4">
                <div
                  className="flex justify-center"
                  title="Bật/Tắt hiển thị trên Banner Trang Chủ"
                >
                  <ToggleSwitch
                    isOn={event.isFeatured}
                    onClick={() => toggleFeatured(event.id)}
                  />
                </div>
              </td>

              <td className="px-6 py-4">
                {event.status === "PUBLISHED" && (
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold flex w-max items-center gap-1">
                    <CheckCircle2 size={14} /> Đang diễn ra
                  </span>
                )}
                {event.status === "PENDING_REVIEW" && (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-md text-xs font-bold flex w-max items-center gap-1">
                    <AlertTriangle size={14} /> Chờ duyệt
                  </span>
                )}
                {event.status === "FORCE_CANCELLED" && (
                  <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold flex w-max items-center gap-1">
                    <Ban size={14} /> Đã đóng băng
                  </span>
                )}
              </td>
              <td className="px-6 py-4 text-center">
                {event.status !== "FORCE_CANCELLED" ? (
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-md text-xs font-bold transition-colors">
                    <Power size={14} /> Đóng băng
                  </button>
                ) : (
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-md text-xs font-bold transition-colors">
                    <Eye size={14} /> Xem lý do
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const renderVenuesTab = () => (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6 animate-in fade-in duration-300">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-[13px] tracking-wider">
            <th className="px-6 py-4 font-bold">Địa điểm</th>
            <th className="px-6 py-4 font-bold">Sức chứa</th>
            <th className="px-6 py-4 font-bold">Khu vực</th>
            <th className="px-6 py-4 font-bold">Trạng thái</th>
            <th className="px-6 py-4 font-bold text-center">Sơ đồ ghế</th>
            <th className="px-6 py-4 font-bold text-center">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {mockVenues.map((venue) => (
            <tr
              key={venue.id}
              className="hover:bg-slate-50/80 transition-colors group"
            >
              <td className="px-6 py-4">
                <div className="font-bold text-slate-900">{venue.name}</div>
                <div className="text-xs text-slate-500 mt-1 flex items-start gap-1">
                  <MapPin size={12} className="mt-0.5 shrink-0" />{" "}
                  {venue.location}
                </div>
              </td>
              <td className="px-6 py-4 font-bold text-slate-700">
                {venue.capacity.toLocaleString()} ghế
              </td>
              <td className="px-6 py-4 font-medium text-blue-600">
                {venue.sectors} khu vực
              </td>
              <td className="px-6 py-4">
                <span
                  className={`px-2.5 py-1 rounded-md text-xs font-bold ${venue.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                >
                  {venue.status}
                </span>
              </td>
              <td className="px-6 py-4 text-center">
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-600 rounded-md text-xs font-bold transition-colors">
                  <Map size={14} /> Cấu hình
                </button>
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
                      venue.status === "ACTIVE"
                        ? "text-emerald-600 hover:text-emerald-700"
                        : "text-amber-500 hover:text-amber-600"
                    }`}
                    title={
                      venue.status === "ACTIVE"
                        ? "Đang hoạt động"
                        : "Đang bảo trì"
                    }
                  >
                    {venue.status === "ACTIVE" ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <AlertTriangle size={18} />
                    )}
                  </button>
                  <button
                    className="text-red-500 hover:text-red-600 transition-colors"
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
  const renderCategoriesTab = () => (
    <div className="mt-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {mockCategories.map((cat) => (
          <div
            key={cat.id}
            className={`p-6 rounded-2xl border shadow-sm hover:shadow-md transition-shadow relative group ${
              cat.name === "Âm nhạc"
                ? "bg-purple-500 border-purple-500"
                : cat.name === "Thể thao"
                  ? "bg-blue-500 border-blue-500"
                  : cat.name === "Hội thảo"
                    ? "bg-amber-500 border-amber-500"
                    : cat.name === "Nghệ thuật"
                      ? "bg-rose-500 border-rose-500"
                      : "bg-white border-slate-200"
            }`}
          >
            <div className="absolute top-4 right-4 flex opacity-0 group-hover:opacity-100 transition-opacity gap-1">
              <button className="p-1.5 text-slate-400 hover:text-blue-600 bg-white hover:bg-blue-50 rounded shadow-sm">
                <Edit size={16} />
              </button>
              <button className="p-1.5 text-slate-400 hover:text-red-600 bg-white hover:bg-red-50 rounded shadow-sm">
                <Trash2 size={16} />
              </button>
            </div>

            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-white ${
                cat.name === "Âm nhạc"
                  ? "text-purple-500"
                  : cat.name === "Thể thao"
                    ? "text-blue-500"
                    : cat.name === "Hội thảo"
                      ? "text-amber-500"
                      : cat.name === "Nghệ thuật"
                        ? "text-rose-500"
                        : "text-slate-500"
              }`}
            >
              {cat.name === "Âm nhạc" ? (
                <Music size={24} />
              ) : cat.name === "Thể thao" ? (
                <Trophy size={24} />
              ) : cat.name === "Hội thảo" ? (
                <BookText size={24} />
              ) : cat.name === "Nghệ thuật" ? (
                <Palette size={24} />
              ) : (
                <Grid size={24} />
              )}
            </div>
            <h3
              className={`text-lg font-bold mb-1 ${["Âm nhạc", "Thể thao", "Hội thảo", "Nghệ thuật"].includes(cat.name) ? "text-white" : "text-slate-900"}`}
            >
              {cat.name}
            </h3>
            <p
              className={`text-sm line-clamp-2 mb-4 h-10 ${["Âm nhạc", "Thể thao", "Hội thảo", "Nghệ thuật"].includes(cat.name) ? "text-white/80" : "text-slate-500"}`}
            >
              {cat.description}
            </p>
            <div
              className={`pt-4 border-t flex items-center justify-between ${["Âm nhạc", "Thể thao", "Hội thảo", "Nghệ thuật"].includes(cat.name) ? "border-white/20" : "border-slate-100"}`}
            >
              <span
                className={`text-xs font-semibold tracking-wider ${["Âm nhạc", "Thể thao", "Hội thảo", "Nghệ thuật"].includes(cat.name) ? "text-white/80" : "text-slate-400"}`}
              >
                Đang hoạt động
              </span>
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                  ["Âm nhạc", "Thể thao", "Hội thảo", "Nghệ thuật"].includes(
                    cat.name,
                  )
                    ? "bg-white/20 text-white"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                {cat.eventCount} Sự kiện
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 bg-[#f8fafc] min-h-screen relative">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Hệ sinh thái sự kiện
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Kiểm duyệt nội dung, phân bổ danh mục và thiết lập địa điểm tổ chức
        </p>
      </div>

      {/* CUSTOM TABS */}
      <div className="flex items-center border-b border-slate-200 gap-8 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("EVENTS")}
          className={`pb-4 font-bold text-sm flex items-center gap-2 transition-colors relative whitespace-nowrap ${activeTab === "EVENTS" ? "text-[#2dc275]" : "text-slate-500 hover:text-slate-800"}`}
        >
          <Calendar size={18} /> Kiểm duyệt sự kiện
          {activeTab === "EVENTS" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#2dc275] rounded-t-full"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("VENUES")}
          className={`pb-4 font-bold text-sm flex items-center gap-2 transition-colors relative whitespace-nowrap ${activeTab === "VENUES" ? "text-[#2dc275]" : "text-slate-500 hover:text-slate-800"}`}
        >
          <MapPin size={18} /> Quản lý địa điểm
          {activeTab === "VENUES" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#2dc275] rounded-t-full"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("CATEGORIES")}
          className={`pb-4 font-bold text-sm flex items-center gap-2 transition-colors relative whitespace-nowrap ${activeTab === "CATEGORIES" ? "text-[#2dc275]" : "text-slate-500 hover:text-slate-800"}`}
        >
          <List size={18} /> Quản lý danh mục
          {activeTab === "CATEGORIES" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#2dc275] rounded-t-full"></span>
          )}
        </button>
      </div>

      {/* THANH TÌM KIẾM */}
      <div className="mt-6 flex items-center gap-4">
        <div className="relative w-full max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="text"
            placeholder={
              activeTab === "EVENTS"
                ? "Tìm theo tên sự kiện, tên BTC"
                : activeTab === "VENUES"
                  ? "Tìm tên địa điểm, địa chỉ"
                  : "Tìm tên danh mục"
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2dc275] shadow-sm transition-colors"
          />
        </div>
        {activeTab === "EVENTS" && (
          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm text-sm">
            <Filter size={18} /> Lọc trạng thái
          </button>
        )}
        {activeTab === "VENUES" && (
          <button className="bg-[#2dc275] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#24a161] transition-colors shadow-sm text-sm flex items-center gap-2 whitespace-nowrap">
            <Plus size={18} /> Thêm địa điểm mới
          </button>
        )}
        {activeTab === "CATEGORIES" && (
          <button className="bg-[#2dc275] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#24a161] transition-colors shadow-sm text-sm flex items-center gap-2 whitespace-nowrap">
            <Plus size={18} /> Thêm danh mục mới
          </button>
        )}
      </div>
      {activeTab === "EVENTS" && renderEventsTab()}
      {activeTab === "VENUES" && renderVenuesTab()}
      {activeTab === "CATEGORIES" && renderCategoriesTab()}
    </div>
  );
}
