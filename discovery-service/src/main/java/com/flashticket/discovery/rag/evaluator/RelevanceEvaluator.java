package com.flashticket.discovery.rag.evaluator;

import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.input.PromptTemplate;
import dev.langchain4j.rag.content.Content;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Đánh giá mức độ liên quan của retrieved documents với câu hỏi.
 * Trả về score 0.0–1.0. Dùng LLM để judge.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RelevanceEvaluator {

    private final ChatModel chatModel;

    private static final String EVAL_PROMPT = """
        Đánh giá mức độ liên quan giữa CÂU HỎI và KẾT QUẢ TÌM KIẾM.
        Trả về CHỈ MỘT số từ 0.0 đến 1.0 (0=không liên quan, 1=hoàn toàn phù hợp).
        Không giải thích.

        CÂU HỎI: {{query}}
        KẾT QUẢ: {{context}}
        """;

    public double evaluate(String query, List<Content> contents) {
        if (contents.isEmpty()) return 0.0;

        String context = contents.stream()
                .map(c -> c.textSegment().text())
                .reduce("", (a, b) -> a + "\n---\n" + b);

        try {
            var userMessage = PromptTemplate.from(EVAL_PROMPT)
                    .apply(Map.of("query", query, "context", context))
                    .toUserMessage();
            String response = chatModel.chat(userMessage).aiMessage().text().trim();
            return Double.parseDouble(response);
        } catch (Exception e) {
            log.warn("[CRAG] Evaluation failed, defaulting to 0.5: {}", e.getMessage());
            return 0.5;
        }
    }
}
