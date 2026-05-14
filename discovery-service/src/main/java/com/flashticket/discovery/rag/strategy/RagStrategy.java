package com.flashticket.discovery.rag.strategy;

import dev.langchain4j.rag.content.Content;
import java.util.List;

/**
 * RAG Strategy interface — polymorphic retrieval strategies.
 * Implementations: SimpleRagStrategy, MultiHopRagStrategy, CorrectiveRagStrategy.
 */
public interface RagStrategy {
    List<Content> retrieve(String query);
    String strategyName();
}
