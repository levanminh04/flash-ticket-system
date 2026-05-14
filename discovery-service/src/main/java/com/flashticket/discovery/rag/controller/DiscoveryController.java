package com.flashticket.discovery.rag.controller;

import com.flashticket.discovery.rag.strategy.AdaptiveRagRouter;
import dev.langchain4j.rag.content.Content;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Semantic search API — public endpoint.
 * GET /api/discovery/search?q=...
 *
 * Uses Adaptive RAG Router to route queries to the appropriate strategy.
 */
@RestController
@RequestMapping("/api/discovery")
@RequiredArgsConstructor
public class DiscoveryController {

    private final AdaptiveRagRouter ragRouter;

    @GetMapping("/search")
    public ResponseEntity<Map<String, Object>> search(
            @RequestParam("q") String query) {

        var ragResult = ragRouter.route(query);

        List<Map<String, Object>> results = ragResult.contents().stream()
                .map(content -> {
                    var metadata = content.textSegment().metadata();
                    return Map.<String, Object>of(
                            "text", content.textSegment().text(),
                            "eventId", metadata.getString("eventId") != null
                                    ? metadata.getString("eventId") : "",
                            "score", 1.0 // PGVector score not propagated in ContentRetriever interface
                    );
                })
                .toList();

        return ResponseEntity.ok(Map.of(
                "query", query,
                "strategy", ragResult.strategy(),
                "resultCount", results.size(),
                "results", results
        ));
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of(
                "service", "discovery-service",
                "status", "UP"
        ));
    }
}
