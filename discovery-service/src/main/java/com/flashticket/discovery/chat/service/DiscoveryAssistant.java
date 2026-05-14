package com.flashticket.discovery.chat.service;

import dev.langchain4j.service.*;

/**
 * LangChain4j AiServices interface — entry point cho toàn bộ AI.
 *
 * ReAct loop tự động: LLM nhận tools → quyết định gọi tool nào →
 * quan sát kết quả → tiếp tục reasoning → trả lời user.
 *
 * System prompt chỉ dẫn:
 * 1. LUÔN xác nhận trước khi booking/payment
 * 2. Trả lời bằng tiếng Việt
 * 3. Gợi ý voucher nếu có
 * 4. Tone phù hợp mood user
 */
@SystemMessage("""
    Bạn là trợ lý AI của FlashTicket — nền tảng bán vé sự kiện trực tuyến.

    NGUYÊN TẮC BẮT BUỘC:
    1. Trả lời bằng TIẾNG VIỆT, thân thiện, chuyên nghiệp.
    2. Khi user muốn ĐẶT VÉ: BẠN PHẢI GỌI `EventSearchTool` (hàm `searchEvents` hoặc `getEventDetail`) để lấy UUID của sự kiện và loại vé.
    3. Sau khi có UUID: GỌI NGAY `BookingTool`. Nếu thiếu SĐT, hãy dùng 'N/A'. TUYỆT ĐỐI KHÔNG trả lời hứa hẹn kiểu "đang xử lý" mà không gọi Tool.
    4. Chỉ trả lời kết quả cuối cùng sau khi Tool đã chạy xong.
    5. Khi user muốn THANH TOÁN: GỌI NGAY `PaymentTool` sau khi xác nhận đơn hàng.

    THÔNG TIN NGƯỜI DÙNG HIỆN TẠI:
    - Tên: {{userName}}
    - Email: {{userEmail}}
    Dùng thông tin này để điền vào BookingTool. Nếu user đã ra lệnh đặt vé, thực hiện ngay các bước gọi Tool liên hoàn, không hỏi lại.

    Khi trả lời về sự kiện, hãy sử dụng thông tin từ context được cung cấp.
    Nếu không tìm thấy thông tin phù hợp, hãy nói rõ và gợi ý user tìm kiếm khác.
    """)
public interface DiscoveryAssistant {

    @UserMessage("{{message}}")                             // định nghĩa tin nhắn của user nhắn vào khung chat (tránh nhầm vói prompt)
    String chat(@MemoryId String sessionId,                 // LangChain4j sẽ dùng sessionId này để lấy lịch sử chat in-memory (kiểm tra trong RAM), xem Langchain4Jconfig.java
                @V("userName") String userName,             // binding String userName vào {{userName}} trong @SystemMessage
                @V("userEmail") String userEmail,
                @V("message") String message);
}



// interface DiscoveryAssistant này giống như userRepository.findByEmail(...) vậy, 1 kiểu lập trình khai báo (deractive programming)
// trong LangChainConfig.java  có dòng config:
//      return AiServices.builder(DiscoveryAssistant.class)
//                         .chatModel(chatModel)
//                         ....
// ta chỉ cần định nghĩa các phương thức và Annotation (@SystemMessage, @UserMessage), còn việc kết nối với Gemini như thế nào thì LangChain4j sẽ tự lo.
// Nó gom toàn bộ (System Prompt + Lịch sử Chat + Dữ liệu sự kiện + Câu hỏi mới của user + Danh sách các Tools) biến thành một cục JSON khổng lồ và gửi qua mạng (HTTP Request) lên server của Google Gemini.






