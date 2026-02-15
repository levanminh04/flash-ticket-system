import { useState } from "react";
import {
  Ticket,
  CalendarDays,
  Users,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
  MoreVertical,
  Calendar,
  HandCoins,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const revenueData = [
  { name: "Tháng 1", revenue: 120000000, tickets: 450 },
  { name: "Tháng 2", revenue: 180000000, tickets: 600 },
  { name: "Tháng 3", revenue: 150000000, tickets: 550 },
  { name: "Tháng 4", revenue: 250000000, tickets: 900 },
  { name: "Tháng 5", revenue: 320000000, tickets: 1200 },
  { name: "Tháng 6", revenue: 280000000, tickets: 1050 },
];
const kpiStats = [
  {
    id: 1,
    title: "Tổng doanh thu",
    value: "10.300.000 đ",
    icon: <HandCoins size={24} />,
    bg: "bg-blue-500",
    iconColor: "text-blue-500",
    trend: "+12.5%",
    isUp: true,
    subtitle: "So với tháng trước",
  },
  {
    id: 2,
    title: "Vé đã bán",
    value: "4,750",
    icon: <Ticket size={24} />,
    bg: "bg-[#2dc275]",
    iconColor: "text-[#2dc275]",
    trend: "+8.2%",
    isUp: true,
    subtitle: "So với tháng trước",
  },
  {
    id: 3,
    title: "Sự kiện hoạt động",
    value: "45",
    icon: <CalendarDays size={24} />,
    bg: "bg-purple-500",
    iconColor: "text-purple-500",
    trend: "-2.0%",
    isUp: false,
    subtitle: "So với tháng trước",
  },
  {
    id: 4,
    title: "Khách hàng mới",
    value: "892",
    icon: <Users size={24} />,
    bg: "bg-orange-500",
    iconColor: "text-orange-500",
    trend: "+15.3%",
    isUp: true,
    subtitle: "So với tháng trước",
  },
  {
    id: 5,
    title: "BTC đăng ký mới",
    value: "18",
    icon: <Briefcase size={24} />,
    bg: "bg-pink-500",
    iconColor: "text-pink-500",
    trend: "+5.0%",
    isUp: true,
    subtitle: "so với tháng trước",
  },
];

const topEvents = [
  {
    id: 1,
    name: "Anh trai vượt ngàn chó cái",
    date: "20/10/2024",
    location: "Trung tâm hội nghị quốc gia",
    organizer: "Yeah1 Group",
    tickets: 1250,
    revenue: "1.000.000.000 đ",
    status: "Sắp diễn ra",
  },
  {
    id: 2,
    name: "Chị đẹp đạp gió rẽ sóng",
    date: "15/11/2024",
    location: "SECC - TP.HCM",
    organizer: "Cát Tiên Sa",
    tickets: 980,
    revenue: "784.000.000 đ",
    status: "Đang mở bán",
  },
  {
    id: 3,
    name: "Lễ hội âm nhạc gió mùa",
    date: "05/12/2024",
    location: "Hoàng Thành Thăng Long",
    organizer: "Thanh Việt Production",
    tickets: 850,
    revenue: "425.000.000 đ",
    status: "Đang mở bán",
  },
  {
    id: 4,
    name: "Vietnam Web Summit 2026",
    date: "10/01/2026",
    location: "Grand Palace",
    organizer: "TopDev",
    tickets: 450,
    revenue: "135.000.000 đ",
    status: "Hoàn thành",
  },
];

const formatCurrency = (value: number | string) => {
  const numValue = Number(value);
  if (isNaN(numValue)) return "0";
  if (numValue >= 1000000000) return `${(numValue / 1000000000).toFixed(1)} Tỷ`;
  if (numValue >= 1000000) return `${(numValue / 1000000).toFixed(0)} Tr`;
  return numValue.toString();
};

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState("Tháng này");

  return (
    <div className="p-6 lg:p-8 bg-[#f8fafc] min-h-screen">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Tổng quan hệ thống
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Theo dõi hoạt động kinh doanh và người dùng của FlashTicket
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-2 shadow-sm">
          <Calendar size={18} className="text-slate-400" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none cursor-pointer"
          >
            <option>Hôm nay</option>
            <option>Tuần này</option>
            <option>Tháng này</option>
            <option>Năm nay</option>
          </select>
        </div>
      </div>

      {/* KPI CARDS (Thống kê tổng quan) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        {kpiStats.map((stat) => (
          <div
            key={stat.id}
            className={`rounded-2xl p-6 border border-white/10 shadow-sm hover:shadow-md transition-shadow ${stat.bg}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div
                className={`p-3 rounded-xl bg-white shadow-sm font-bold ${stat.iconColor}`}
              >
                {stat.icon}
              </div>
              <button className="text-white/70 hover:text-white transition-colors">
                <MoreVertical size={20} />
              </button>
            </div>
            <div>
              <h3 className="text-sm font-medium text-white/80 mb-1">
                {stat.title}
              </h3>
              <p className="text-2xl font-bold text-white mb-2">{stat.value}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/70">{stat.subtitle}</span>
                <span className="flex items-center font-bold text-white bg-white/20 px-2 py-0.5 rounded-lg backdrop-blur-sm">
                  {stat.isUp ? (
                    <ArrowUpRight size={14} className="mr-0.5" />
                  ) : (
                    <ArrowDownRight size={14} className="mr-0.5" />
                  )}
                  {stat.trend}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CHARTS AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Biểu đồ doanh thu
              </h2>
              <p className="text-sm text-slate-500">
                Thống kê doanh thu theo thời gian
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-[#2dc275]"></span>{" "}
                Doanh thu
              </span>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={revenueData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickFormatter={(val: any) => formatCurrency(val)}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  formatter={(value: any) => {
                    const numValue = Number(value);
                    if (isNaN(numValue)) return ["0", "Doanh thu"];
                    return [
                      new Intl.NumberFormat("vi-VN", {
                        style: "currency",
                        currency: "VND",
                      }).format(numValue),
                      "Doanh thu",
                    ];
                  }}
                />
                <Bar
                  dataKey="revenue"
                  fill="#2dc275"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Biểu đồ Tăng trưởng User / Ticket (Chiếm 1/3 không gian) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Biểu đồ tăng trưởng vé
              </h2>
              <p className="text-sm text-slate-500">Số vé bán ra mỗi tháng</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-full bg-[#3B82F6]"></span> Số
                vé
              </span>
            </div>
          </div>

          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={revenueData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  formatter={(value: any) => [value, "Số vé bán ra"]}
                />
                <Line
                  type="monotone"
                  dataKey="tickets"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* TOP SỰ KIỆN & HOẠT ĐỘNG GẦN ĐÂY */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Danh sách sự kiện có doanh thu cao nhất
          </h2>
          <button className="text-sm font-semibold text-[#2dc275] hover:text-[#1e8a52]">
            Xem tất cả
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm">
                <th className="px-6 py-4 font-medium">Tên sự kiện</th>
                <th className="px-6 py-4 font-medium">Thời gian</th>
                <th className="px-6 py-4 font-medium">Địa điểm tổ chức</th>
                <th className="px-6 py-4 font-medium">Nhà tổ chức</th>
                <th className="px-6 py-4 font-medium text-left">Trạng thái</th>
                <th className="px-6 py-4 font-medium text-right">Vé bán</th>
                <th className="px-6 py-4 font-medium text-right">Doanh thu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {topEvents.map((event) => (
                <tr
                  key={event.id}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {event.name}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{event.date}</td>
                  <td className="px-6 py-4 text-slate-600">{event.location}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {event.organizer}
                  </td>
                  <td className="px-6 py-4 text-left">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        event.status === "Đang mở bán"
                          ? "bg-blue-100 text-blue-700"
                          : event.status === "Hoàn thành"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {event.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-600">
                    {event.tickets}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-900">
                    {event.revenue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
