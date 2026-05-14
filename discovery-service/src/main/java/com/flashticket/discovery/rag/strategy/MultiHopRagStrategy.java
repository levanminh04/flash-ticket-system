package com.flashticket.discovery.rag.strategy;

import dev.langchain4j.model.chat.ChatModel;
import dev.langchain4j.model.input.PromptTemplate;
import dev.langchain4j.rag.content.Content;
import com.flashticket.discovery.rag.retriever.EventContentRetriever;
import dev.langchain4j.rag.query.Query;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Multi-hop RAG: Phân rã câu hỏi phức tạp → nhiều sub-queries → merge.
 *
 * Flow:
 * 1. LLM decompose: "Tìm concert rock ở HN giá rẻ" → ["concert rock Hà Nội", "sự kiện giá dưới 500k"]
 * 2. Mỗi sub-query → EventContentRetriever → List<Content>
 * 3. Deduplicate by eventId
 * 4. Trả về merged context cho LLM final answer
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MultiHopRagStrategy implements RagStrategy {

    private final ChatModel chatModel;
    private final EventContentRetriever retriever;

    private static final String DECOMPOSE_PROMPT = """
        Phân tích câu hỏi sau thành tối đa 3 sub-queries đơn giản để tìm kiếm sự kiện.
        Mỗi sub-query trên 1 dòng riêng. Không đánh số. Không giải thích.
        Câu hỏi: {{query}}
        """;

    @Override
    public List<Content> retrieve(String query) {
        // Step 1: Decompose
        var userMessage = PromptTemplate.from(DECOMPOSE_PROMPT)
                .apply(Map.of("query", query))
                .toUserMessage();
        String decomposed = chatModel.chat(userMessage).aiMessage().text();

        List<String> subQueries = Arrays.stream(decomposed.split("\n"))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .limit(3)
                .toList();  // tách 3 subqueries ra

        log.info("[MultiHop] Decomposed into {} sub-queries: {}", subQueries.size(), subQueries);

        // Step 2: Retrieve for each sub-query
        Set<String> seenEventIds = new HashSet<>();
        List<Content> mergedResults = new ArrayList<>();

        for (String subQuery : subQueries) {
            var results = retriever.retrieve(Query.from(subQuery));
            for (Content content : results) {
                String eventId = content.textSegment().metadata().getString("eventId"); // TextSegment chứa text và metadata
                if (eventId != null && seenEventIds.add(eventId)) {
                    mergedResults.add(content);
                }
            }
        }

        log.info("[MultiHop] Total unique results: {}", mergedResults.size());
        return mergedResults;
    }

    @Override
    public String strategyName() { return "MULTI_HOP"; }
}
