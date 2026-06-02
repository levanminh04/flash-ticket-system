package com.flashticket.discovery.config;

import com.flashticket.discovery.agent.tool.BookingTool;
import com.flashticket.discovery.agent.tool.EventSearchTool;
import com.flashticket.discovery.agent.tool.PaymentTool;
import com.flashticket.discovery.chat.service.DiscoveryAssistant;
import com.flashticket.discovery.rag.strategy.AdaptiveRagRouter;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.memory.chat.MessageWindowChatMemory;
import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
// [OLD — Google AI Studio] import dev.langchain4j.model.googleai.GoogleAiEmbeddingModel;
import dev.langchain4j.model.vertexai.VertexAiEmbeddingModel;
import dev.langchain4j.model.vertexai.VertexAiGeminiChatModel;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import dev.langchain4j.service.AiServices;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.pgvector.PgVectorEmbeddingStore;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * LangChain4j bean configuration.
 *
 * EmbeddingModel: Vertex AI gemini-embedding-001 (768 dimensions).
 * EmbeddingStore: PGVector (PostgreSQL) — table discovery_schema.event_embeddings.
 * DiscoveryAssistant: AiServices wiring LLM + RAG + ChatMemory + Tools.
 *
 * ChatModel is manually created via VertexAiGeminiChatModel.builder()
 * reading GCP credentials directly from environment variables (discovery-service/.env).
 */
@Configuration
public class LangChainConfig {


    // ── ChatModel (Gemini LLM) ────────────────────────────────────────────────
    // Tự tạo thủ công thay vì dựa vào auto-configuration (cần Config Server chạy).
    // Đọc trực tiếp từ biến môi trường trong discovery-service/.env
    @Bean
    VertexAiGeminiChatModel vertexAiGeminiChatModel(
            @Value("${GCP_PROJECT_ID}") String project,
            @Value("${GCP_LOCATION:us-central1}") String location,
            @Value("${GEMINI_MODEL:gemini-2.5-flash}") String modelName) {
        return VertexAiGeminiChatModel.builder()
                .project(project)
                .location(location)
                .modelName(modelName)
                .temperature(0.3f)
                .build();
    }

    // ── EmbeddingModel (xử lý text thành vector) ─────────────────────────────
    // [OLD — Google AI Studio]
    // @Bean
    // EmbeddingModel embeddingModel(
    //         @Value("${langchain4j.google-ai-gemini.chat-model.api-key}") String apiKey) {
    //     return GoogleAiEmbeddingModel.builder()
    //             .apiKey(apiKey)
    //             .modelName("gemini-embedding-001")
    //             .build();
    // }
    @Bean
    EmbeddingModel embeddingModel(
            @Value("${GCP_PROJECT_ID}") String project,
            @Value("${GCP_LOCATION:us-central1}") String location) {
        return VertexAiEmbeddingModel.builder()
                .project(project)
                .location(location)
                .publisher("google")
                .modelName("gemini-embedding-001")
                .build();
    }



    // Embedding Store (Vector Database), PgVector là 1 loại Embedding Store. lưu trữ các vector đã được tạo ra từ EmbeddingModel vào PostgreSQL
    @Bean
    EmbeddingStore<TextSegment> embeddingStore(
            @Value("${spring.datasource.url}") String url,
            @Value("${spring.datasource.username}") String user,
            @Value("${spring.datasource.password}") String password) {
        return PgVectorEmbeddingStore.builder()
                .host(extractHost(url))
                .port(extractPort(url))
                .database(extractDatabase(url))
                .user(user)
                .password(password)
                .table("discovery_schema.event_embeddings") // bảng event_embeddings do Langchain4j tự tạo với 4 cột mặc định
                .dimension(3072) // Vertex AI gemini-embedding-001 = 3072 dims (Google AI Studio = 768)
                .createTable(true)
                .build();
    }

    /**
     DiscoveryAssistant (AiServices)
     Mục đích: Bean này kết nối tất cả các thành phần lại với nhau:
         - ChatModel: class đại diện cho LLM (Gemini). chịu trách nhiệm nhận văn bản và trả về văn bản.
         - AdaptiveRagRouter: router phân tích câu hỏi của khách hàng, route sang strategy khác nhau, tiết kiện token nếu chỉ là 1 câu hỏi đơn giản
         - ChatMemory: Nhớ lại những gì vừa nói.
         - ContentRetriever: Lấy dữ liệu từ RAG.
         - Tools: Thực hiện các hành động (Đặt vé, Thanh toán).
     */
    @Bean
    DiscoveryAssistant discoveryAssistant(
            // [OLD — Google AI Studio] @Qualifier("googleAiGeminiChatModel") ChatModel chatModel,
            ChatModel chatModel,
            AdaptiveRagRouter adaptiveRagRouter,
            EventSearchTool eventSearchTool,
            BookingTool bookingTool,
            PaymentTool paymentTool) {
        return AiServices.builder(DiscoveryAssistant.class)
                .chatModel(chatModel)
                .chatMemoryProvider(sessionId -> MessageWindowChatMemory.builder()    // in-memory lưu lịch sử trò chuyện trong RAM
                        .id(sessionId) // khách hàng A và khách hàng B. Mỗi người sẽ có một session riêng.
                        .maxMessages(20) // AI sẽ chỉ nhớ 20 tin nhắn gần nhất. Khi có tin nhắn thứ 21, tin nhắn số 1 sẽ bị xóa.
                        .build())        // MessageWindowChatMemory là cửa sổ trượt k = 20
                .contentRetriever(adaptiveRagRouter) // không cấu hình contentRetriever() thì đây chỉ là call API LLM đơn thuần, không có RAG, Bất cứ khi nào tôi gọi hàm chat(), hãy dùng ông adaptiveRagRouter này để đi tìm kiếm ngữ cảnh (RAG) cho tôi
                .tools(eventSearchTool, bookingTool, paymentTool) // LLM từ đọc mô tả của mỗi tool để chọn ra tool phù hợp
                .build();
    }

    // ── JDBC URL Parsing Helpers ──────────────────────────────────────────────
    // String url = "jdbc:postgresql://127.0.0.1:5433/flash_ticket_db?ssl=true";

    private static final Pattern JDBC_URL_PATTERN =
            Pattern.compile("jdbc:postgresql://([^:/]+)(?::(\\d+))?/([^?]+)");

    static String extractHost(String jdbcUrl) { // Output: "127.0.0.1"
        Matcher m = JDBC_URL_PATTERN.matcher(jdbcUrl);
        if (m.find()) return m.group(1);
        throw new IllegalArgumentException("Cannot extract host from JDBC URL: " + jdbcUrl);
    }

    static int extractPort(String jdbcUrl) {  // Output: 5433
        Matcher m = JDBC_URL_PATTERN.matcher(jdbcUrl);
        if (m.find() && m.group(2) != null) return Integer.parseInt(m.group(2));
        return 5432; // Default PostgreSQL port
    }

    static String extractDatabase(String jdbcUrl) {  // Output: "flash_ticket_db"
        Matcher m = JDBC_URL_PATTERN.matcher(jdbcUrl);
        if (m.find()) return m.group(3);
        throw new IllegalArgumentException("Cannot extract database from JDBC URL: " + jdbcUrl);
    }
}
