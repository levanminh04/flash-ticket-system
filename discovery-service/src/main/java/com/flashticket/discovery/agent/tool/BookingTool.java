package com.flashticket.discovery.agent.tool;

import com.flashticket.discovery.chat.service.JwtContextHolder;
import com.flashticket.discovery.shared.client.CoreServiceClient;
import com.flashticket.discovery.shared.client.CoreServiceClient.CreateBookingPayload;
import com.flashticket.discovery.shared.client.CoreServiceClient.CreateBookingPayload.BookingItem;
import dev.langchain4j.agent.tool.P;
import dev.langchain4j.agent.tool.Tool;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.UUID;

/**
 * Tool tạo đơn đặt vé — gọi POST /api/bookings trên core-service.
 *
 * RÀNG BUỘC QUAN TRỌNG:
 * - Chỉ gọi SAU KHI user confirm rõ ràng trong chat
 * - Chỉ tạo Order(PENDING) — không confirm trực tiếp
 * - JWT lấy từ ThreadLocal (JwtContextHolder), KHÔNG qua LLM parameter
 * - Forward JWT gốc → core-service validate IDOR + TOCTOU protection
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BookingTool {

    private final CoreServiceClient coreClient;

    @Tool("""
        Tạo đơn đặt vé cho user. CHỈ gọi khi user đã XÁC NHẬN muốn đặt.
        Trả về thông tin đơn hàng nếu thành công, hoặc lỗi nếu thất bại.
        Đơn sẽ có trạng thái PENDING và hết hạn sau 15 phút nếu chưa thanh toán.
        """)
    public String createBooking(
            @P("UUID của sự kiện") String eventId,
            @P("UUID của loại vé") String ticketTypeId,
            @P("Số lượng vé (1-10)") int quantity,
            @P("Tên khách hàng") String customerName,
            @P("Email khách hàng") String customerEmail,
            @P("Số điện thoại (optional, null nếu không có)") String customerPhone,
            @P("Mã voucher (optional, null nếu không có)") String promotionCode) {

        String jwt = JwtContextHolder.get();
        if (jwt == null) {
            return "ERROR: Phiên đăng nhập hết hạn, vui lòng đăng nhập lại.";
        }

        log.info("[BookingTool] Creating booking: event={}, ticket={}, qty={}",
                eventId, ticketTypeId, quantity);

        var payload = new CreateBookingPayload(
                UUID.fromString(eventId),
                List.of(new BookingItem(UUID.fromString(ticketTypeId), quantity)),
                customerName, customerEmail, customerPhone,
                promotionCode, null
        );

        return coreClient.createBooking(jwt, payload);
    }
}
