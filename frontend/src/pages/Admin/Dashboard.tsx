import { useState } from 'react';
import { 
  DollarSign, Ticket, CalendarDays, Users, 
  Briefcase, ArrowUpRight, ArrowDownRight, 
  MoreVertical, Calendar
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

const revenueData = [
  { name: 'Thg 1', revenue: 120000000, tickets: 450 },
  { name: 'Thg 2', revenue: 180000000, tickets: 600 },
  { name: 'Thg 3', revenue: 150000000, tickets: 550 },
  { name: 'Thg 4', revenue: 250000000, tickets: 900 },
  { name: 'Thg 5', revenue: 320000000, tickets: 1200 },
  { name: 'Thg 6', revenue: 280000000, tickets: 1050 },
];
const kpiStats = [
  { 
    id: 1, title: 'Tổng Doanh Thu', value: '10.300.000 đ', 
    icon: <DollarSign size={24} />, color: 'text-blue-600', bg: 'bg-blue-100',
    trend: '+12.5%', isUp: true, subtitle: 'so với tháng trước'
  },
  { 
    id: 2, title: 'Vé Đã Bán', value: '4,750', 
    icon: <Ticket size={24} />, color: 'text-[#2dc275]', bg: 'bg-[#e6f8ee]',
    trend: '+8.2%', isUp: true, subtitle: 'so với tháng trước'
  },
  { 
    id: 3, title: 'Sự Kiện Active', value: '45', 
    icon: <CalendarDays size={24} />, color: 'text-purple-600', bg: 'bg-purple-100',
    trend: '-2.0%', isUp: false, subtitle: 'so với tháng trước'
  },
  { 
    id: 4, title: 'Khách Hàng Mới', value: '892', 
    icon: <Users size={24} />, color: 'text-orange-600', bg: 'bg-orange-100',
    trend: '+15.3%', isUp: true, subtitle: 'so với tháng trước'
  },
  { 
    id: 5, title: 'BTC Đăng Ký Mới', value: '18', 
    icon: <Briefcase size={24} />, color: 'text-pink-600', bg: 'bg-pink-100',
    trend: '+5.0%', isUp: true, subtitle: 'so với tháng trước'
  }
];

const topEvents = [
  { id: 1, name: 'Anh Trai Vượt Ngàn Chông Gai', tickets: 1250, revenue: '1.000.000.000đ', status: 'Sắp diễn ra' },
  { id: 2, name: 'Chị Đẹp Đạp Gió Rẽ Sóng', tickets: 980, revenue: '784.000.000đ', status: 'Đang mở bán' },
  { id: 3, name: 'Lễ Hội Âm Nhạc Gió Mùa', tickets: 850, revenue: '425.000.000đ', status: 'Đang mở bán' },
  { id: 4, name: 'Vietnam Web Summit 2026', tickets: 450, revenue: '135.000.000đ', status: 'Hoàn thành' },
];

const formatCurrency = (value: number | string) => {
  const numValue = Number(value);
  if (isNaN(numValue)) return "0";
  if (numValue >= 1000000000) return `${(numValue / 1000000000).toFixed(1)} Tỷ`;
  if (numValue >= 1000000) return `${(numValue / 1000000).toFixed(0)} Tr`;
  return numValue.toString();
};

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState('Tháng này');

  return (
    <div className="p-6 lg:p-8 bg-[#f8fafc] min-h-screen">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tổng Quan Hệ Thống</h1>
          <p className="text-sm text-slate-500 mt-1">Theo dõi hoạt động kinh doanh và người dùng của FlashTicket</p>
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
          <div key={stat.id} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                {stat.icon}
              </div>
              <button className="text-slate-400 hover:text-slate-600">
                <MoreVertical size={20} />
              </button>
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-500 mb-1">{stat.title}</h3>
              <p className="text-2xl font-bold text-slate-900 mb-2">{stat.value}</p>
              <div className="flex items-center gap-2 text-xs">
                <span className={`flex items-center font-medium ${stat.isUp ? 'text-emerald-600' : 'text-red-500'}`}>
                  {stat.isUp ? <ArrowUpRight size={14} className="mr-0.5" /> : <ArrowDownRight size={14} className="mr-0.5" />}
                  {stat.trend}
                </span>
                <span className="text-slate-400">{stat.subtitle}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CHARTS AREA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Biểu đồ Doanh thu (Chiếm 2/3 không gian) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Biểu Đồ Doanh Thu</h2>
              <p className="text-sm text-slate-500">Thống kê doanh thu theo thời gian</p>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#2dc275]"></span> Doanh thu</span>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val: any) => formatCurrency(val)} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => {
                    const numValue = Number(value);
                    if(isNaN(numValue)) return ["0", "Doanh thu"];
                    return [new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(numValue), "Doanh thu"];
                  }}
                />
                <Bar dataKey="revenue" fill="#2dc275" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Biểu đồ Tăng trưởng User / Ticket (Chiếm 1/3 không gian) */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Tăng Trưởng Vé</h2>
              <p className="text-sm text-slate-500">Số vé bán ra mỗi tháng</p>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any) => [value, "Số vé bán ra"]}
                />
                <Line type="monotone" dataKey="tickets" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* TOP SỰ KIỆN & HOẠT ĐỘNG GẦN ĐÂY */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Top Sự Kiện Có Doanh Thu Cao Nhất</h2>
          <button className="text-sm font-semibold text-[#2dc275] hover:text-[#1e8a52]">Xem tất cả</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm">
                <th className="px-6 py-4 font-medium">Tên Sự Kiện</th>
                <th className="px-6 py-4 font-medium">Trạng Thái</th>
                <th className="px-6 py-4 font-medium text-right">Số Vé Đã Bán</th>
                <th className="px-6 py-4 font-medium text-right">Tổng Doanh Thu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {topEvents.map((event) => (
                <tr key={event.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{event.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      event.status === 'Đang mở bán' ? 'bg-blue-100 text-blue-700' :
                      event.status === 'Hoàn thành' ? 'bg-slate-100 text-slate-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {event.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-slate-600">{event.tickets}</td>
                  <td className="px-6 py-4 text-right font-bold text-[#2dc275]">{event.revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}