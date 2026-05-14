package com.flashticket.discovery.rag.strategy;

import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.input.PromptTemplate;
import dev.langchain4j.rag.content.Content;
import com.flashticket.discovery.rag.evaluator.RelevanceEvaluator;
import com.flashticket.discovery.rag.retriever.EventContentRetriever;
import dev.langchain4j.rag.query.Query;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * CRAG: Retrieve → Evaluate → nếu score thấp → Rewrite query → Retry.
 * Max 2 lần retry. Threshold: 0.6.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CorrectiveRagStrategy implements RagStrategy {

    private final EventContentRetriever retriever;
    private final RelevanceEvaluator evaluator;
    private final ChatModel chatModel;

    private static final double RELEVANCE_THRESHOLD = 0.6;
    private static final int MAX_RETRIES = 2;

    private static final String REWRITE_PROMPT = """
        Câu hỏi sau không tìm được kết quả tốt. Hãy viết lại thành ĐÚNG 1 câu hỏi duy nhất, rõ ràng và đầy đủ ngữ cảnh hơn.
        Tuyệt đối không liệt kê danh sách, không dùng Markdown, không thêm lời chào, chỉ trả về đúng 1 câu duy nhất.

        Câu hỏi gốc: {{query}}
        """;

    @Override
    public List<Content> retrieve(String query) {
        String currentQuery = query;

        for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            var results = retriever.retrieve(Query.from(currentQuery));
            double score = evaluator.evaluate(query, results); // luôn eval vs original query

            log.info("[CRAG] Attempt {}: query='{}', score={}, results={}",
                    attempt, currentQuery, score, results.size());

            if (score >= RELEVANCE_THRESHOLD || attempt == MAX_RETRIES) {
                return results;
            }

            // Rewrite query
            var userMessage = PromptTemplate.from(REWRITE_PROMPT)
                    .apply(Map.of("query", currentQuery))
                    .toUserMessage();
            currentQuery = chatModel.chat(userMessage).aiMessage().text().trim();

            log.info("[CRAG] Rewritten query: '{}'", currentQuery);
        }
        return List.of(); // unreachable
    }

    @Override
    public String strategyName() { return "CRAG"; }
}
