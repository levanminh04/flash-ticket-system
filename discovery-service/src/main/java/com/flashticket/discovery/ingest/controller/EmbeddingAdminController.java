package com.flashticket.discovery.ingest.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flashticket.discovery.ingest.service.EmbeddingIngestionService;
import com.flashticket.discovery.ingest.service.EmbeddingIngestionService.EventSyncMessage;
import com.flashticket.discovery.shared.client.CoreServiceClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
// import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;

/**
 * Admin endpoint để bulk reindex embeddings cho tất cả events.
 *
 * USE CASE: Dữ liệu được crawl trực tiếp vào DB (bỏ qua RabbitMQ flow),
 * nên không có embeddings trong PGVector. Endpoint này sẽ:
 * 1. Gọi core-service lấy tất cả events (phân trang)
 * 2. Lấy detail từng event (để có description, categories, tags, venue address, organizer)
 * 3. Tạo embeddings và lưu vào PGVector
 *
 * POST /api/discovery/admin/reindex — Reindex tất cả events
 * POST /api/discovery/admin/reindex/{eventId} — Reindex 1 event cụ thể
 */
@RestController
@RequestMapping("/api/discovery/admin")
@RequiredArgsConstructor
@Slf4j
public class EmbeddingAdminController {

    private final CoreServiceClient coreClient;
    private final EmbeddingIngestionService ingestionService;
    private final ObjectMapper objectMapper;

    /**
     * Bulk reindex TẤT CẢ events từ core-service.
     * Quá trình chạy đồng bộ — response trả về khi hoàn tất.
     *
     * @param pageSize số events mỗi trang (default 50)
     */
    @PostMapping("/reindex")
    // @PreAuthorize("hasRole('ADMIN')") // TODO: bật lại trước khi lên production
    public ResponseEntity<Map<String, Object>> reindexAll(
            @RequestParam(defaultValue = "50") int pageSize) {

        log.info("[AdminReindex] Starting bulk reindex with pageSize={}", pageSize);
        long startTime = System.currentTimeMillis();

        int page = 0;
        int totalProcessed = 0;
        int totalFailed = 0;
        List<String> failedEventIds = new ArrayList<>();

        try {
            while (true) {
                // 1. Lấy danh sách events (paginated) từ core-service
                String listJson = coreClient.searchAllEvents(page, pageSize);
                JsonNode pageNode = objectMapper.readTree(listJson);
                JsonNode content = pageNode.get("content");

                if (content == null || !content.isArray() || content.isEmpty()) {
                    log.info("[AdminReindex] No more events at page {}", page);
                    break;
                }

                log.info("[AdminReindex] Processing page {}, events: {}", page, content.size());

                // 2. Với mỗi event, lấy detail rồi tạo embedding
                for (JsonNode eventNode : content) {
                    String eventId = eventNode.get("id").asText();
                    try {
                        String detailJson = coreClient.getEventDetail(eventId);
                        JsonNode detail = objectMapper.readTree(detailJson);

                        EventSyncMessage message = mapToSyncMessage(detail);
                        ingestionService.upsertEvent(message);
                        totalProcessed++;

                        if (totalProcessed % 10 == 0) {
                            log.info("[AdminReindex] Progress: {} events processed", totalProcessed);
                        }
                    } catch (Exception e) {
                        totalFailed++;
                        failedEventIds.add(eventId);
                        log.error("[AdminReindex] Failed to index event: {}", eventId, e);
                    }
                }

                // 3. Kiểm tra còn trang tiếp không
                boolean isLast = pageNode.has("last") && pageNode.get("last").asBoolean();
                if (isLast) break;
                page++;
            }
        } catch (Exception e) {
            log.error("[AdminReindex] Fatal error during reindex", e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "Reindex failed: " + e.getMessage(),
                    "totalProcessed", totalProcessed,
                    "totalFailed", totalFailed
            ));
        }

        long elapsed = System.currentTimeMillis() - startTime;
        log.info("[AdminReindex] Completed: processed={}, failed={}, elapsed={}ms",
                totalProcessed, totalFailed, elapsed);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", "COMPLETED");
        result.put("totalProcessed", totalProcessed);
        result.put("totalFailed", totalFailed);
        result.put("elapsedMs", elapsed);
        if (!failedEventIds.isEmpty()) {
            result.put("failedEventIds", failedEventIds);
        }
        return ResponseEntity.ok(result);
    }

    /**
     * Reindex 1 event cụ thể bằng eventId.
     */
    @PostMapping("/reindex/{eventId}")
    // @PreAuthorize("hasRole('ADMIN')") // TODO: bật lại trước khi lên production
    public ResponseEntity<Map<String, Object>> reindexOne(@PathVariable String eventId) {
        log.info("[AdminReindex] Reindexing single event: {}", eventId);

        try {
            String detailJson = coreClient.getEventDetail(eventId);
            JsonNode detail = objectMapper.readTree(detailJson);

            EventSyncMessage message = mapToSyncMessage(detail);
            ingestionService.upsertEvent(message);

            return ResponseEntity.ok(Map.of(
                    "status", "OK",
                    "eventId", eventId,
                    "title", message.title() != null ? message.title() : ""
            ));
        } catch (Exception e) {
            log.error("[AdminReindex] Failed to reindex event: {}", eventId, e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "status", "FAILED",
                    "eventId", eventId,
                    "error", e.getMessage() != null ? e.getMessage() : "Unknown error"
            ));
        }
    }

    // ── Mapper: EventDetailResponse JSON → EventSyncMessage ──────────────────

    private EventSyncMessage mapToSyncMessage(JsonNode detail) {
        UUID eventId = UUID.fromString(detail.get("id").asText());
        String title = textOrNull(detail, "title");
        String description = textOrNull(detail, "description");
        String shortDescription = textOrNull(detail, "shortDescription");
        String status = textOrNull(detail, "status");

        // Categories
        List<String> categories = new ArrayList<>();
        JsonNode catNode = detail.get("categories");
        if (catNode != null && catNode.isArray()) {
            for (JsonNode c : catNode) {
                String name = textOrNull(c, "name");
                if (name != null) categories.add(name);
            }
        }

        // Tags
        List<String> tags = new ArrayList<>();
        JsonNode tagNode = detail.get("tags");
        if (tagNode != null && tagNode.isArray()) {
            for (JsonNode t : tagNode) {
                tags.add(t.asText());
            }
        }

        // Organizer
        String organizerId = null;
        String organizerName = null;
        JsonNode orgNode = detail.get("organizer");
        if (orgNode != null && !orgNode.isNull()) {
            organizerId = textOrNull(orgNode, "id");
            organizerName = textOrNull(orgNode, "name");
        }

        // MinPrice
        BigDecimal minPrice = null;
        // Thử lấy từ ticketTypes nếu không có trường minPrice trực tiếp
        JsonNode minPriceNode = detail.get("minPrice");
        if (minPriceNode != null && !minPriceNode.isNull()) {
            minPrice = new BigDecimal(minPriceNode.asText());
        } else {
            // Tính minPrice từ ticketTypes
            JsonNode ticketTypes = detail.get("ticketTypes");
            if (ticketTypes != null && ticketTypes.isArray()) {
                for (JsonNode tt : ticketTypes) {
                    JsonNode priceNode = tt.get("price");
                    if (priceNode != null && !priceNode.isNull()) {
                        BigDecimal price = new BigDecimal(priceNode.asText());
                        if (minPrice == null || price.compareTo(minPrice) < 0) {
                            minPrice = price;
                        }
                    }
                }
            }
        }

        // Schedule / datetime
        String startDatetime = null;
        String endDatetime = null;
        JsonNode scheduleNode = detail.get("schedule");
        if (scheduleNode != null && !scheduleNode.isNull()) {
            startDatetime = textOrNull(scheduleNode, "startDatetime");
            endDatetime = textOrNull(scheduleNode, "endDatetime");
        }
        // Fallback: trường trực tiếp trên detail
        if (startDatetime == null) startDatetime = textOrNull(detail, "startDatetime");
        if (endDatetime == null) endDatetime = textOrNull(detail, "endDatetime");

        // Venue
        String venueName = null;
        String venueAddress = null;
        JsonNode venueNode = detail.get("venue");
        if (venueNode != null && !venueNode.isNull()) {
            venueName = textOrNull(venueNode, "name");
            venueAddress = textOrNull(venueNode, "address");
        }

        return new EventSyncMessage(
                eventId, title, description, shortDescription,
                categories, tags, organizerId, organizerName,
                status, minPrice, startDatetime, endDatetime,
                venueName, venueAddress
        );
    }

    private String textOrNull(JsonNode node, String field) {
        JsonNode child = node.get(field);
        if (child == null || child.isNull()) return null;
        return child.asText();
    }
}
