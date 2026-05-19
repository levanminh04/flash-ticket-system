package com.flashticket.discovery.rag.strategy;

import dev.langchain4j.rag.content.Content;
import com.flashticket.discovery.rag.retriever.EventContentRetriever;
import dev.langchain4j.rag.query.Query;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.List;

/**
 * Simple RAG strategy — direct vector search without decomposition or correction.
 */
@Component
@RequiredArgsConstructor
public class SimpleRagStrategy implements RagStrategy {
    private final EventContentRetriever retriever;

    @Override
    public List<Content> retrieve(String query) {
        return retriever.retrieve(Query.from(query));
    }

    @Override
    public String strategyName() { return "SIMPLE"; }
}
