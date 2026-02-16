import { useState } from "react";
import {
  Bot,
  Database,
  MessageSquare,
  UploadCloud,
  FileText,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Search,
  Eye,
  Trash2,
  X,
  User,
  ChevronRight,
  CornerDownRight,
} from "lucide-react";

// ==========================================
// MOCK DATA (Dựa trên ai_schema)
// ==========================================
const mockDocuments = [
  {
    id: "DOC-001",
    title: "Quy_dinh_doi_tra_ve_2026.pdf",
    type: "PDF",
    size: "2.4 MB",
    status: "EMBEDDED",
    chunks: 145,
    uploadedAt: "16/02/2026 09:15",
  },
  {
    id: "DOC-002",
    title: "FAQ_Huong_dan_chuyen_nhuong.txt",
    type: "TXT",
    size: "45 KB",
    status: "EMBEDDED",
    chunks: 24,
    uploadedAt: "15/02/2026 14:30",
  },
  {
    id: "DOC-003",
    title: "Thong_tin_su_kien_Anh_Trai.pdf",
    type: "PDF",
    size: "5.1 MB",
    status: "PROCESSING",
    chunks: 0,
    uploadedAt: "16/02/2026 16:45",
  },
  {
    id: "DOC-004",
    title: "Dieu_khoan_dich_vu_v2.docx",
    type: "DOCX",
    size: "1.2 MB",
    status: "ERROR",
    chunks: 0,
    uploadedAt: "14/02/2026 10:00",
  },
];

const mockConversations = [
  {
    id: "CONV-101",
    customerName: "Tuyến Phạm",
    lastMessage: "Bot: Tiền hoàn sẽ được chuyển trong 3-5 ngày...",
    time: "10:30",
    status: "RESOLVED",
  },
  {
    id: "CONV-102",
    customerName: "Minh Lê",
    lastMessage: "User: Làm sao để chuyển vé cho bạn?",
    time: "09:15",
    status: "NEEDS_IMPROVEMENT",
  },
  {
    id: "CONV-103",
    customerName: "Hải Nguyễn",
    lastMessage: "Bot: Sự kiện bắt đầu lúc 20:00 tại SVĐ Mỹ Đình.",
    time: "Hôm qua",
    status: "RESOLVED",
  },
];

const mockMessages: Record<string, any[]> = {
  "CONV-101": [
    {
      id: "M1",
      sender: "USER",
      text: "Cho mình hỏi sự kiện Cười Xuyên Việt bị hủy thì bao giờ mình nhận lại được tiền?",
      time: "10:25",
    },
    {
      id: "M2",
      sender: "AI",
      text: "Chào bạn, theo quy định hoàn tiền tự động của FlashTicket, đối với các sự kiện bị hủy (FORCE_CANCELLED), hệ thống sẽ tự động hoàn tiền về tài khoản ngân hàng/ví điện tử mà bạn đã sử dụng để thanh toán.",
      time: "10:25",
    },
    {
      id: "M3",
      sender: "USER",
      text: "Vậy cụ thể là mấy ngày có tiền?",
      time: "10:28",
    },
    {
      id: "M4",
      sender: "AI",
      text: "Tiền hoàn sẽ được chuyển trong 3-5 ngày làm việc (không tính Thứ 7, Chủ Nhật) tùy thuộc vào ngân hàng phát hành thẻ của bạn ạ.",
      time: "10:30",
    },
  ],
  "CONV-102": [
    {
      id: "M5",
      sender: "USER",
      text: "Làm sao để chuyển vé cho bạn?",
      time: "09:15",
    },
    {
      id: "M6",
      sender: "AI",
      text: "Xin lỗi, tôi chưa hiểu rõ câu hỏi của bạn. Bạn muốn chuyển nhượng vé đã mua cho người khác phải không?",
      time: "09:15",
    },
  ],
};

export default function AiManagement() {
  const [activeTab, setActiveTab] = useState<"KNOWLEDGE" | "CHATS">(
    "KNOWLEDGE",
  );
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedConv, setSelectedConv] = useState(mockConversations[0].id);

  // ==========================================
  // TAB 1: KHO TRI THỨC (Knowledge Base)
  // ==========================================
  const renderKnowledgeBase = () => (
    <div className="mt-6 animate-in fade-in duration-300">
      {/* Upload Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-[#0f172a] rounded-2xl p-8 text-white flex items-center justify-between shadow-lg mb-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
          <Database size={200} className="-mt-10 -mr-10" />
        </div>
        <div className="relative z-10">
          <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
            Hệ thống RAG (Retrieval-Augmented Generation)
          </h2>
          <p className="text-blue-200 max-w-2xl text-sm leading-relaxed">
            Tải lên tài liệu PDF, TXT để nhúng (Embedding) vào cơ sở dữ liệu
            Vector. Chatbot AI sẽ đọc các tài liệu này để trả lời khách hàng một
            cách chính xác nhất.
          </p>
        </div>
        <button
          onClick={() => setIsUploadOpen(true)}
          className="relative z-10 bg-[#2dc275] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#24a161] transition-all shadow-md flex items-center gap-2"
        >
          <UploadCloud size={20} /> Tải tài liệu lên
        </button>
      </div>

      {/* Documents Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-[13px] tracking-wider">
              <th className="px-6 py-4 font-bold">Tên tài liệu</th>
              <th className="px-6 py-4 font-bold">Thời gian</th>
              <th className="px-6 py-4 font-bold">Kích thước</th>
              <th className="px-6 py-4 font-bold text-center">Vectors</th>
              <th className="px-6 py-4 font-bold">Trạng thái</th>
              <th className="px-6 py-4 font-bold text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {mockDocuments.map((doc) => (
              <tr
                key={doc.id}
                className="hover:bg-slate-50/80 transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${doc.type === "PDF" ? "bg-red-50 text-red-500" : "bg-blue-50 text-blue-500"}`}
                    >
                      <FileText size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">
                        {doc.title}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-500 text-sm">
                  {doc.uploadedAt}
                </td>
                <td className="px-6 py-4 text-slate-600 font-medium">
                  {doc.size}
                </td>
                <td className="px-6 py-4 text-center font-mono font-bold text-slate-700">
                  {doc.chunks > 0 ? doc.chunks : "-"}
                </td>
                <td className="px-6 py-4">
                  {doc.status === "EMBEDDED" && (
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold flex w-max items-center gap-1.5">
                      <CheckCircle2 size={14} /> Hoàn tất
                    </span>
                  )}
                  {doc.status === "PROCESSING" && (
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-bold flex w-max items-center gap-1.5">
                      <Loader2 size={14} className="animate-spin" /> Đang xử
                      lý...
                    </span>
                  )}
                  {doc.status === "ERROR" && (
                    <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold flex w-max items-center gap-1.5">
                      <AlertCircle size={14} /> Lỗi file
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Xem chi tiết"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Xóa tài liệu"
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
    </div>
  );

  // ==========================================
  // TAB 2: THEO DÕI LỊCH SỬ CHAT
  // ==========================================
  const renderChatHistory = () => (
    <div className="mt-6 flex h-[600px] bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-300">
      {/* Cột trái: Danh sách hội thoại */}
      <div className="w-1/3 border-r border-slate-200 flex flex-col bg-slate-50">
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Tìm tên khách hàng..."
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2dc275]/50"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {mockConversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => setSelectedConv(conv.id)}
              className={`p-4 border-b border-slate-100 cursor-pointer transition-colors ${selectedConv === conv.id ? "bg-blue-50 border-l-4 border-l-blue-500" : "hover:bg-slate-100 border-l-4 border-l-transparent"}`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <User size={14} className="text-slate-400" />{" "}
                  {conv.customerName}
                </span>
                <span className="text-[11px] text-slate-400">{conv.time}</span>
              </div>
              <p className="text-xs text-slate-500 line-clamp-1 mb-2">
                {conv.lastMessage}
              </p>
              {conv.status === "NEEDS_IMPROVEMENT" && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold">
                  Cần tối ưu RAG
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Cột phải: Chi tiết tin nhắn */}
      <div className="flex-1 flex flex-col bg-[#f8fafc]">
        {/* Chat Header */}
        <div className="h-16 px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="font-bold text-slate-800 flex items-center gap-2">
            Đoạn chat với khách hàng:{" "}
            <span className="text-[#2dc275]">
              {
                mockConversations.find((c) => c.id === selectedConv)
                  ?.customerName
              }
            </span>
          </div>
          <button className="text-sm font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
            Chuyển cho Nhân viên <ChevronRight size={16} />
          </button>
        </div>

        {/* Chat Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {(mockMessages[selectedConv] || []).map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === "USER" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] rounded-2xl px-5 py-3 shadow-sm ${
                  msg.sender === "USER"
                    ? "bg-[#2dc275] text-white rounded-tr-sm"
                    : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
                }`}
              >
                {msg.sender === "AI" && (
                  <div className="text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                    <Bot size={12} /> FlashTicket AI
                  </div>
                )}
                <p className="text-sm leading-relaxed">{msg.text}</p>
                <div
                  className={`text-[10px] mt-2 text-right ${msg.sender === "USER" ? "text-emerald-100" : "text-slate-400"}`}
                >
                  {msg.time}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Chat Footer (Chỉ để Admin phân tích) */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 text-xs text-slate-500 flex items-center gap-2 justify-center italic">
          <CornerDownRight size={14} /> Admin chỉ xem (View-only mode). Không
          thể chat trực tiếp từ giao diện này.
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 bg-[#f8fafc] min-h-screen relative">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Trợ lý ảo
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Huấn luyện dữ liệu cho Bot và giám sát chất lượng phản hồi
        </p>
      </div>

      {/* TABS */}
      <div className="flex items-center border-b border-slate-200 gap-8">
        <button
          onClick={() => setActiveTab("KNOWLEDGE")}
          className={`pb-4 font-bold text-sm flex items-center gap-2 transition-colors relative ${activeTab === "KNOWLEDGE" ? "text-[#2dc275]" : "text-slate-500 hover:text-slate-800"}`}
        >
          <Database size={18} /> Kho tri thức
          {activeTab === "KNOWLEDGE" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#2dc275] rounded-t-full"></span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("CHATS")}
          className={`pb-4 font-bold text-sm flex items-center gap-2 transition-colors relative ${activeTab === "CHATS" ? "text-[#2dc275]" : "text-slate-500 hover:text-slate-800"}`}
        >
          <MessageSquare size={18} /> Lịch sử chat
          {activeTab === "CHATS" && (
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#2dc275] rounded-t-full"></span>
          )}
        </button>
      </div>

      {/* RENDER */}
      {activeTab === "KNOWLEDGE" ? renderKnowledgeBase() : renderChatHistory()}

      {/* MODAL UPLOAD TÀI LIỆU */}
      {isUploadOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <UploadCloud className="text-[#2dc275]" /> Tải tài liệu lên
              </h3>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center py-12 px-6 text-center hover:border-[#2dc275] hover:bg-[#e6f8ee] transition-colors cursor-pointer group">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-[#2dc275] group-hover:scale-110 transition-transform mb-4">
                  <UploadCloud size={32} />
                </div>
                <h4 className="font-bold text-slate-800 mb-1">
                  Kéo thả file vào đây
                </h4>
                <p className="text-sm text-slate-500 mb-4">
                  hoặc click để chọn file từ máy tính
                </p>
                <p className="text-xs text-slate-400 font-medium">
                  Hỗ trợ: PDF, TXT, DOCX (Tối đa 10MB)
                </p>
              </div>

              <div className="mt-6 bg-blue-50 border border-blue-100 p-4 rounded-lg text-sm text-blue-800 flex gap-3">
                <AlertCircle className="shrink-0 text-blue-600" size={20} />
                <p>
                  Sau khi upload, hệ thống sẽ tự động băm nhỏ tài liệu và lưu
                  trữ dưới dạng vector. Quá trình này có thể mất vài phút.
                </p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setIsUploadOpen(false)}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100"
              >
                Hủy
              </button>
              <button className="px-6 py-2.5 bg-[#2dc275] text-white font-bold rounded-xl hover:bg-[#24a161] shadow-sm flex items-center gap-2">
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
