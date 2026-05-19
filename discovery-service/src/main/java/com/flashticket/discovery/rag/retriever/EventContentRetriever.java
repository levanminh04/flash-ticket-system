package com.flashticket.discovery.rag.retriever;

import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.rag.content.Content;
import dev.langchain4j.rag.content.retriever.ContentRetriever;
import dev.langchain4j.rag.query.Query;
import dev.langchain4j.store.embedding.EmbeddingSearchRequest;
import dev.langchain4j.store.embedding.EmbeddingStore;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Simple RAG retriever — tìm events gần nhất trong PGVector.
 * maxResults = 5, minScore = 0.7 (chỉ trả kết quả đủ relevant).
 */
@Component
@RequiredArgsConstructor
public class EventContentRetriever implements ContentRetriever {

    private final EmbeddingStore<TextSegment> embeddingStore;
    private final EmbeddingModel embeddingModel;

    private static final int MAX_RESULTS = 5;
    private static final double MIN_SCORE = 0.7;

    @Override
    public List<Content> retrieve(Query query) { // query là message của User => 1 vector duy nhất
        var embedding = embeddingModel.embed(query.text()).content(); // gọi model gemini-embedding-001 chuyển message thanh vector
        // Thiết lập cấu hình tìm kiếm
        var searchRequest = EmbeddingSearchRequest.builder()
                .queryEmbedding(embedding) // input cho tìm kiếm
                .maxResults(MAX_RESULTS)   // lấy tối đa 5 sự kiện/đoạn text có ý nghĩa giống nhất để đưa vào Prompt. 5 content trả về vẫn có khả năng là của cùng 1 sự kiện
                .minScore(MIN_SCORE)       // Similarity Score
                // ← KHÔNG CÓ .filter() nào ở đây
                .build();
        return embeddingStore.search(searchRequest).matches().stream()  // .search() của pgvector dùng cosine simalirity
                .map(match -> Content.from(match.embedded()))// .embedded() là TextSegment
                .toList();
    }
}
