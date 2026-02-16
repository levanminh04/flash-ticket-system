import { useState } from "react";
import {
  Search,
  Filter,
  Receipt,
  Ticket as TicketIcon,
  CreditCard,
  Eye,
  CheckCircle2,
  Clock,
  X,
  AlertTriangle,
  QrCode,
  RefreshCcw,
  Download,
} from "lucide-react";
const mockOrders = [
  {
    id: "ORD-20260216-001",
    customerName: "Tuyến Phạm",
    customerEmail: "tuyen@example.com",
    eventTitle: "Anh Trai Vượt Ngàn Chông Gai",
    totalAmount: 2400000,
    status: "COMPLETED",
    createdAt: "16/02/2026 10:30",
    items: [
      {
        id: "ITM-1",
        ticketType: "VIP",
        price: 1200000,
        seat: "Khu A - Ghế A12",
      },
      {
        id: "ITM-2",
        ticketType: "VIP",
        price: 1200000,
        seat: "Khu A - Ghế A13",
      },
    ],
  },
  {
    id: "ORD-20260216-002",
    customerName: "Minh Lê",
    customerEmail: "minh@example.com",
    eventTitle: "Vietnam Web Summit",
    totalAmount: 500000,
    status: "PENDING",
    createdAt: "16/02/2026 11:15",
    items: [
      {
        id: "ITM-3",
        ticketType: "Standard",
        price: 500000,
        seat: "Khu C - Tự do",
      },
    ],
  },
  {
    id: "ORD-20260215-089",
    customerName: "Hải Nguyễn",
    customerEmail: "hai@gmail.com",
    eventTitle: "Show Hài: Cười Xuyên Việt",
    totalAmount: 800000,
    status: "CANCELLED",
    createdAt: "15/02/2026 09:00",
    items: [
      { id: "ITM-4", ticketType: "GA", price: 400000, seat: "Khu B - Ghế B01" },
      { id: "ITM-5", ticketType: "GA", price: 400000, seat: "Khu B - Ghế B02" },
    ],
  },
];

const mockTickets = [
  {
    code: "TCK-A12-987654",
    event: "Anh Trai Vượt Ngàn Chông Gai",
    customer: "Tuyến Phạm",
    type: "VIP",
    seat: "A12",
    status: "SCANNED",
    scannedAt: "15/04/2026 18:45",
  },
  {
    code: "TCK-A13-987655",
    event: "Anh Trai Vượt Ngàn Chông Gai",
    customer: "Tuyến Phạm",
    type: "VIP",
    seat: "A13",
    status: "UNUSED",
    scannedAt: null,
  },
  {
    code: "TCK-C00-112233",
    event: "Vietnam Web Summit",
    customer: "Minh Lê",
    type: "Standard",
    seat: "Tự do",
    status: "UNUSED",
    scannedAt: null,
  },
];

const mockTransactions = [
  {
    id: "TXN-VNPay-001",
    orderId: "ORD-20260216-001",
    gateway: "VNPay",
    amount: 2400000,
    type: "PAYMENT",
    status: "SUCCESS",
    date: "16/02/2026 10:35",
  },
  {
    id: "TXN-MoMo-002",
    orderId: "ORD-20260216-002",
    gateway: "MoMo",
    amount: 500000,
    type: "PAYMENT",
    status: "PENDING",
    date: "16/02/2026 11:15",
  },
  {
    id: "REF-VNPay-089",
    orderId: "ORD-20260215-089",
    gateway: "VNPay",
    amount: 800000,
    type: "REFUND",
    status: "PENDING",
    date: "16/02/2026 08:00",
    reason: "Sự kiện bị hủy",
  },
];

export default function OrderManagement() {
  const [activeTab, setActiveTab] = useState<
    "ORDERS" | "TICKETS" | "TRANSACTIONS"
  >("ORDERS");
  const [searchTerm, setSearchTerm] = useState("");

  // State quản lý Modal
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedRefund, setSelectedRefund] = useState<any | null>(null);

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  // ==========================================
  // TAB 1: QUẢN LÝ ĐƠN HÀNG
  // ==========================================
  const renderOrdersTab = () => (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6 animate-in fade-in">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-[13px] tracking-wider">
            <th className="px-6 py-4 font-bold">Mã đơn</th>
            <th className="px-6 py-4 font-bold">Khách hàng</th>
            <th className="px-6 py-4 font-bold">Email</th>
            <th className="px-6 py-4 font-bold">Sự kiện</th>
            <th className="px-6 py-4 font-bold text-right">Tổng Tiền</th>
            <th className="px-6 py-4 font-bold">Trạng thái</th>
            <th className="px-6 py-4 font-bold text-center">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {mockOrders.map((order) => (
            <tr
              key={order.id}
              className="hover:bg-slate-50/80 transition-colors"
            >
              <td className="px-6 py-4">
                <div className="font-bold text-slate-900">{order.id}</div>
              </td>
              <td className="px-6 py-4">
                <div className="font-bold text-slate-900">
                  {order.customerName}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-slate-500">
                  {order.customerEmail}
                </div>
              </td>
              <td className="px-6 py-4 font-medium text-slate-700">
                {order.eventTitle}
              </td>
              <td className="px-6 py-4 text-right font-bold text-[#2dc275]">
                {formatVND(order.totalAmount)}
              </td>
              <td className="px-6 py-4">
                {order.status === "COMPLETED" && (
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold">
                    Thành công
                  </span>
                )}
                {order.status === "PENDING" && (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-md text-xs font-bold">
                    Chờ thanh toán
                  </span>
                )}
                {order.status === "CANCELLED" && (
                  <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold">
                    Đã hủy
                  </span>
                )}
              </td>
              <td className="px-6 py-4 text-center">
                <button
                  onClick={() => setSelectedOrder(order)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-md text-xs font-bold transition-colors"
                >
                  <Eye size={14} /> Chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  // ==========================================
  // TAB 2: TRA CỨU VÉ (TICKET TRACKING)
  // ==========================================
  const renderTicketsTab = () => (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6 animate-in fade-in">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-[13px] tracking-wider">
            <th className="px-6 py-4 font-bold">Mã vé</th>
            <th className="px-6 py-4 font-bold">Sự kiện</th>
            <th className="px-6 py-4 font-bold">Khách hàng</th>
            <th className="px-6 py-4 font-bold">Loại vé</th>
            <th className="px-6 py-4 font-bold">Ghế</th>
            <th className="px-6 py-4 font-bold">Check-in</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {mockTickets.map((ticket) => (
            <tr
              key={ticket.code}
              className="hover:bg-slate-50/80 transition-colors"
            >
              <td className="px-6 py-4">
                <div className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded w-max flex items-center gap-2">
                  <QrCode size={14} className="text-slate-500" /> {ticket.code}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="font-bold text-slate-700">{ticket.event}</div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-slate-500">{ticket.customer}</div>
              </td>
              <td className="px-6 py-4">
                <span className="font-semibold text-purple-600">
                  {ticket.type}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="text-slate-500 font-medium">
                  {ticket.seat}
                </span>
              </td>
              <td className="px-6 py-4">
                {ticket.status === "SCANNED" ? (
                  <div>
                    <span className="flex items-center gap-1 text-[#2dc275] font-semibold text-xs">
                      <CheckCircle2 size={14} /> Đã Check-in
                    </span>
                    <span className="text-[11px] text-slate-400 mt-0.5 block">
                      {ticket.scannedAt}
                    </span>
                  </div>
                ) : (
                  <span className="flex items-center gap-1 text-slate-400 font-semibold text-xs">
                    <Clock size={14} /> Chưa sử dụng
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const renderTransactionsTab = () => (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mt-6 animate-in fade-in">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-[13px] tracking-wider">
            <th className="px-6 py-4 font-bold">Mã giao dịch</th>
            <th className="px-6 py-4 font-bold">Thời gian</th>
            <th className="px-6 py-4 font-bold">Mã đơn hàng</th>
            <th className="px-6 py-4 font-bold">Loại</th>
            <th className="px-6 py-4 font-bold">Cổng</th>
            <th className="px-6 py-4 font-bold text-right">Số Tiền</th>
            <th className="px-6 py-4 font-bold text-center">Trạng Thái</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
          {mockTransactions.map((txn) => (
            <tr key={txn.id} className="hover:bg-slate-50/80 transition-colors">
              <td className="px-6 py-4">
                <div className="font-mono font-bold text-slate-900">
                  {txn.id}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-xs text-slate-500">{txn.date}</div>
              </td>
              <td className="px-6 py-4 font-medium text-slate-600">
                {txn.orderId}
              </td>
              <td className="px-6 py-4">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${txn.type === "PAYMENT" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}
                >
                  {txn.type}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="font-semibold text-slate-700">
                  {txn.gateway}
                </span>
              </td>
              <td className="px-6 py-4 text-right font-bold text-slate-900">
                {txn.type === "REFUND" ? "-" : "+"}
                {formatVND(txn.amount)}
              </td>
              <td className="px-6 py-4 text-center">
                {txn.type === "REFUND" && txn.status === "PENDING" ? (
                  <button
                    onClick={() => setSelectedRefund(txn)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 rounded-md text-xs font-bold transition-colors shadow-sm"
                  >
                    <RefreshCcw size={14} /> Xử lý hoàn tiền
                  </button>
                ) : (
                  <span
                    className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                      txn.status === "SUCCESS"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {txn.status}
                  </span>
                )}
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
          Quản lý đơn hàng và tài chính
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Quản lý vé đã bán, đối soát giao dịch thanh toán và xử lý hoàn tiền
        </p>
      </div>

      {/* CUSTOM TABS */}
      <div className="flex items-center border-b border-slate-200 gap-8 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab("ORDERS")}
          className={`pb-4 font-bold text-sm flex items-center gap-2 transition-colors relative whitespace-nowrap ${activeTab === "ORDERS" ? "text-[#2dc275]" : "text-slate-500 hover:text-slate-800"}`}
        >
          <Receipt size={18} /> Quản lý đơn hàng
          {activeTab === "ORDERS" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#2dc275] rounded-t-full"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("TICKETS")}
          className={`pb-4 font-bold text-sm flex items-center gap-2 transition-colors relative whitespace-nowrap ${activeTab === "TICKETS" ? "text-[#2dc275]" : "text-slate-500 hover:text-slate-800"}`}
        >
          <TicketIcon size={18} />
          Tra cứu vé
          {activeTab === "TICKETS" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#2dc275] rounded-t-full"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("TRANSACTIONS")}
          className={`pb-4 font-bold text-sm flex items-center gap-2 transition-colors relative whitespace-nowrap ${activeTab === "TRANSACTIONS" ? "text-[#2dc275]" : "text-slate-500 hover:text-slate-800"}`}
        >
          <CreditCard size={18} />
          Giao dịch và hoàn tiền
          <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-[10px] ml-1">
            1 Yêu cầu
          </span>
          {activeTab === "TRANSACTIONS" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#2dc275] rounded-t-full"></span>
          )}
        </button>
      </div>

      {/* THANH TÌM KIẾM CHUNG */}
      <div className="mt-6 flex items-center gap-4">
        <div className="relative w-full max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="text"
            placeholder={
              activeTab === "ORDERS"
                ? "Tìm mã đơn hàng, email khách..."
                : activeTab === "TICKETS"
                  ? "Quét / Nhập mã vé, QR Code..."
                  : "Tìm mã giao dịch, mã đơn..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2dc275] shadow-sm transition-colors"
          />
        </div>
        <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm text-sm">
          <Filter size={18} /> Lọc trạng thái
        </button>
        <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm text-sm ml-auto">
          <Download size={18} /> Xuất Excel
        </button>
      </div>
      {activeTab === "ORDERS" && renderOrdersTab()}
      {activeTab === "TICKETS" && renderTicketsTab()}
      {activeTab === "TRANSACTIONS" && renderTransactionsTab()}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="text-[#2dc275]" /> Chi tiết đơn hàng:{" "}
                <span className="font-mono text-blue-600">
                  {selectedOrder.id}
                </span>
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-xs font-bold text-slate-400 tracking-wider mb-1">
                    Khách hàng
                  </p>
                  <p className="font-bold text-slate-900">
                    {selectedOrder.customerName}
                  </p>
                  <p className="text-sm text-slate-600">
                    {selectedOrder.customerEmail}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 tracking-wider mb-1">
                    Sự kiện
                  </p>
                  <p className="font-bold text-slate-900">
                    {selectedOrder.eventTitle}
                  </p>
                  <p className="text-sm text-slate-600">
                    {selectedOrder.createdAt}
                  </p>
                </div>
              </div>

              <p className="text-xs font-bold text-slate-400 tracking-wider mb-2">
                Danh sách vé
              </p>
              <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50">
                  <tr className="text-xs text-slate-500">
                    <th className="px-4 py-2 font-bold">Mã hạng mục</th>
                    <th className="px-4 py-2 font-bold">Loại vé</th>
                    <th className="px-4 py-2 font-bold">Vị trí ghế</th>
                    <th className="px-4 py-2 font-bold text-right">Đơn giá</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {selectedOrder.items.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {item.id}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {item.ticketType}
                      </td>
                      <td className="px-4 py-3 text-blue-600 font-medium">
                        {item.seat}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatVND(item.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-700">
                  Tổng cộng thanh toán:
                </span>
                <span className="text-2xl font-black text-[#2dc275]">
                  {formatVND(selectedOrder.totalAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* MODAL 2: XỬ LÝ HOÀN TIỀN (Refunds)         */}
      {/* ========================================== */}
      {selectedRefund && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-red-100 bg-red-50 flex items-center justify-between">
              <h3 className="font-bold text-red-700 flex items-center gap-2">
                <AlertTriangle /> Yêu Cầu Hoàn Tiền (Refund)
              </h3>
              <button
                onClick={() => setSelectedRefund(null)}
                className="text-red-400 hover:text-red-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <p className="text-sm text-slate-500 mb-1">
                  Mã Giao dịch Refund:{" "}
                  <span className="font-mono text-slate-900 font-bold">
                    {selectedRefund.id}
                  </span>
                </p>
                <p className="text-sm text-slate-500 mb-1">
                  Mã Đơn gốc:{" "}
                  <span className="font-mono text-slate-900 font-bold">
                    {selectedRefund.orderId}
                  </span>
                </p>
                <p className="text-sm text-slate-500">
                  Lý do:{" "}
                  <span className="text-red-600 font-medium">
                    {selectedRefund.reason}
                  </span>
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="font-bold text-slate-700">
                  Số tiền cần hoàn ({selectedRefund.gateway}):
                </span>
                <span className="text-2xl font-black text-red-600">
                  {formatVND(selectedRefund.amount)}
                </span>
              </div>
              <p className="text-xs text-slate-400 italic">
                Lưu ý: Thao tác "Phê duyệt" sẽ gọi API sang hệ thống Payment
                Gateway ({selectedRefund.gateway}) để trả tiền về thẻ của khách.
                Hành động này không thể hoàn tác.
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3 justify-end">
              <button
                onClick={() => setSelectedRefund(null)}
                className="px-4 py-2 border border-slate-200 bg-white text-slate-700 font-bold rounded-lg hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button className="px-6 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 flex items-center gap-2 shadow-sm">
                <CheckCircle2 size={18} /> Phê duyệt Hoàn Tiền
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
