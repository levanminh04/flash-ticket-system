package com.flashticket.discovery.ingest.service;

import dev.langchain4j.data.document.Document;
import dev.langchain4j.data.document.Metadata;
import dev.langchain4j.data.document.splitter.DocumentSplitters;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.filter.MetadataFilterBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Chuyển Event data thành embeddings và lưu vào PGVector.
 *
 * Document format:
 * "[Title] - [Description] | Thể loại: [categories] | Giá từ: [minPrice]
 *  | Ngày: [startDate] | Địa điểm: [venue] | Tags: [tags]"
 *
 * Metadata: eventId, organizerId, status, minPrice — dùng cho filtering.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class EmbeddingIngestionService {

    private final EmbeddingStore<TextSegment> embeddingStore;
    private final EmbeddingModel embeddingModel;

    public void upsertEvent(EventSyncMessage event) {
        // 1. Xóa embeddings cũ của event này (by metadata filter)
        try {
            embeddingStore.removeAll(
                MetadataFilterBuilder.metadataKey("eventId").isEqualTo(event.eventId().toString()));
        } catch (Exception e) {
            log.warn("[Ingest] Failed to remove old embeddings for event: {}, continuing with upsert", event.eventId());
        }

        // 2. Build document text
        String text = buildEventText(event); // text này để sau khi đã lọc bằng vector, LLM sẽ dùng text để biết thêm thông tin ngoài 4 metadata

        // 3. Build metadata
        Metadata metadata = new Metadata();
        metadata.put("eventId", event.eventId().toString());
        if (event.organizerId() != null) metadata.put("organizerId", event.organizerId());
        if (event.status() != null) metadata.put("status", event.status());
        if (event.minPrice() != null) metadata.put("minPrice", event.minPrice().toString());

        // 4. Split thành segments (chunk 500 chars, overlap 50)
        Document doc = Document.from(text, metadata);

        var segments = DocumentSplitters
                .recursive(500, 50) // đệ quy để tránh cắt đôi 1 từ hoàn chỉnh, cố gắng cắt từ cuối câu, cuối đoạn, không mất ngữ nghĩa
                .split(doc);

        // Bản chất của hàm embedAll là nó chỉ rút lấy phần chữ (text) của từng khúc, gửi lên API của Google, và lấy về Vector.
        var embeddings = embeddingModel.embedAll(segments).content(); // quá 500 kí tự là thêm 1 vector, 1 sự kiện nếu quá dài có thể được biểu diễn bởi nhiều vector
        embeddingStore.addAll(embeddings, segments);

        log.info("[Ingest] Upserted {} segments for event: {}", segments.size(), event.title());
    }

    public void deleteEvent(String eventId) {
        try {
            embeddingStore.removeAll(
                MetadataFilterBuilder.metadataKey("eventId").isEqualTo(eventId));
            log.info("[Ingest] Deleted embeddings for event: {}", eventId);
        } catch (Exception e) {
            log.error("[Ingest] Failed to delete embeddings for event: {}", eventId, e);
        }
    }

    private String buildEventText(EventSyncMessage e) {
        return String.format("""
            %s - %s
            Thể loại: %s | Giá từ: %s VND
            Ngày diễn ra: %s | Địa điểm: %s
            Tags: %s | Tổ chức bởi: %s
            """,
            nullSafe(e.title()), nullSafe(e.description()),
            e.categories() != null ? String.join(", ", e.categories()) : "",
            e.minPrice() != null ? e.minPrice() : "N/A",
            nullSafe(e.startDatetime()), nullSafe(e.venueName()),
            e.tags() != null ? String.join(", ", e.tags()) : "",
            nullSafe(e.organizerName()));
    }

    private String nullSafe(String s) {
        return s != null ? s : "";
    }

    /** DTO nhận từ RabbitMQ */
    public record EventSyncMessage(
        UUID eventId,
        String title,
        String description,
        String shortDescription,
        List<String> categories,
        List<String> tags,
        String organizerId,
        String organizerName,
        String status,
        BigDecimal minPrice,
        String startDatetime,
        String endDatetime,
        String venueName,
        String venueAddress
    ) {}
}
