package com.flashticket.discovery.agent.tool;

import com.flashticket.discovery.shared.client.CoreServiceClient;
import dev.langchain4j.agent.tool.P;
import dev.langchain4j.agent.tool.Tool;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Tool tìm kiếm sự kiện qua core-service REST API.
 * Kết quả trả về JSON cho LLM parse.
 */
@Component
@RequiredArgsConstructor
public class EventSearchTool {

    private final CoreServiceClient coreClient;

    @Tool("Tìm kiếm sự kiện theo từ khóa. Trả về danh sách sự kiện với id, title, date, price, venue.")
    public String searchEvents(
            @P("Từ khóa tìm kiếm sự kiện") String keyword) {
        return coreClient.searchEvents(keyword, 0, 5);
    }

    @Tool("Xem chi tiết một sự kiện cụ thể bằng eventId. Trả về thông tin đầy đủ gồm loại vé, giá, số lượng còn.")
    public String getEventDetail(
            @P("UUID của sự kiện cần xem chi tiết") String eventId) {
        return coreClient.getEventDetail(eventId);
    }
}
