package com.flashticket.discovery.rag.strategy;

import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.input.PromptTemplate;
import dev.langchain4j.rag.content.Content;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import dev.langchain4j.rag.query.Query;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * ContentRetriever là interface tiêu chuẩn để LangChain4j biết cách tự động đi tìm ngữ cảnh.
 * Cấu hình trong LangChainConfig.java
 *      AiServices.builder(DiscoveryAssistant.class)
 *          ....
 *      .contentRetriever(adaptiveRagRouter)
 *
 * Routing logic:
 * - DIRECT: Greeting/chitchat → no retrieval needed
 * - SIMPLE: Single-topic event search → direct vector search
 * - MULTI_HOP: Complex multi-criteria query → decompose & merge
 * - CRAG: Ambiguous/broad query → retrieve-evaluate-rewrite loop
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AdaptiveRagRouter implements ContentRetriever {

    /** ThreadLocal to expose which strategy was used to the caller (ChatService). */
    private static final ThreadLocal<String> LAST_STRATEGY = new ThreadLocal<>();

    public static String getLastStrategy() { return LAST_STRATEGY.get(); }
    public static void clearLastStrategy() { LAST_STRATEGY.remove(); }

    private final ChatModel chatModel;
    private final SimpleRagStrategy simpleStrategy;
    private final MultiHopRagStrategy multiHopStrategy;
    private final CorrectiveRagStrategy correctiveStrategy;


    /**
     *  Trước khi tìm kiếm, router hỏi LLM: "Câu này thuộc loại nào?". Việc phân loại giúp hệ thống tiết kiệm tiền (Token).
     *  Ví dụ: Nếu người dùng chỉ nói "Chào bạn", Router sẽ chọn DIRECT và không tốn công đi lục lọi Database
     * */

    private static final String CLASSIFY_PROMPT = """
        Phân loại câu hỏi sau vào ĐÚNG 1 loại. Trả về CHỈ 1 từ:

        DIRECT — Chào hỏi, tán gẫu, cung cấp thông tin cá nhân, xác nhận đơn hàng, đồng ý đặt vé
        SIMPLE — Hỏi về 1 sự kiện cụ thể, 1 thể loại, 1 tiêu chí rõ ràng
        MULTI_HOP — Nhiều tiêu chí kết hợp (thể loại + địa điểm + giá + thời gian)
        CRAG — Câu hỏi mơ hồ, không rõ muốn gì, cần diễn giải lại

        Câu hỏi: {{query}}
        """;


    /**
     * retrieve() của  interface ContentRetrieve bắt buộc trả về là List<Content>, sau khi retrieve() xong ,
     * quyền điều khiển trả về Langchain4J, LangChain4j sẽ duyệt qua List<Content> , mỗi content là 1 Chunk
     * */
    @Override
    public List<Content> retrieve(Query query) {
        RagResult result = route(query.text());
        LAST_STRATEGY.set(result.strategy());
        return result.contents();
    }

    public RagResult route(String query) {
        String strategy = classify(query);
        log.info("[AdaptiveRAG] Classified '{}' → {}", query, strategy);

        List<Content> contents = switch (strategy) {
            case "DIRECT" -> List.of();
            case "MULTI_HOP" -> multiHopStrategy.retrieve(query);
            case "CRAG" -> correctiveStrategy.retrieve(query);
            default -> simpleStrategy.retrieve(query);
        };

        return new RagResult(strategy, contents);
    }

    private String classify(String query) {
        try {
            var userMessage = PromptTemplate.from(CLASSIFY_PROMPT)
                    .apply(Map.of("query", query))
                    .toUserMessage();
            String result = chatModel.chat(userMessage).aiMessage().text().trim().toUpperCase();
            return switch (result) {
                case "DIRECT", "SIMPLE", "MULTI_HOP", "CRAG" -> result;
                default -> "SIMPLE"; // fallback
            };
        } catch (Exception e) {
            log.warn("[AdaptiveRAG] Classification failed, defaulting SIMPLE: {}", e.getMessage());
            return "SIMPLE";
        }
    }

    public record RagResult(
            String strategy,
            List<Content> contents) {}
}



/**
 * CRAG đang được xử lý như một route song song với SIMPLE và MULTI_HOP — điều này sai về mặt khái niệm.
 * CRAG không phải là một loại query — nó là một lớp kiểm tra chất lượng có thể áp dụng lên BẤT KỲ strategy nào.
 * Hiện tại, CRAG chỉ chạy khi query được classify là "mơ hồ". Còn SIMPLE và MULTI_HOP sẽ không bao giờ tự sửa nếu kết quả kém.
 * */

