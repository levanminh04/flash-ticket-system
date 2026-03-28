package com.flashticket.core.event.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * 1 Event có duy nhất 1 Layout riêng (UNIQUE event_id).
 */
@Entity
@Table(name = "event_layouts", schema = "event_schema", indexes = {
    @Index(name = "idx_event_layouts_event", columnList = "event_id")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EventLayout {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * 1:1 với Event — UNIQUE constraint ở DB.
     * LAZY để tránh load Event khi chỉ cần thao tác Layout.
     */
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false, unique = true)
    private Event event;

    @Column
    private String name;

    // Background image (upload lên Cloudinary trước, truyền URL vào đây)
    @Column(name = "background_image_url", length = 500)
    private String backgroundImageUrl;

    @Column(name = "background_public_id")
    private String backgroundPublicId;

    @Column(name = "background_width")
    private Integer backgroundWidth;

    @Column(name = "background_height")
    private Integer backgroundHeight;

    /**
     * Renderer/Designer config: zoom, grid, viewport...
     * Lưu dạng JSONB linh hoạt cho Frontend Konva.js renderer.
     *
     * Ví dụ:
     * {
     *   "minZoom": 0.5, "maxZoom": 3.0, "defaultZoom": 1.0,
     *   "gridSize": 30, "viewport": { "width": 1200, "height": 800 }
     * }
     */
    @Type(JsonType.class)
    @Column(name = "map_config", columnDefinition = "jsonb")
    private Map<String, Object> mapConfig;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", length = 50)
    @Builder.Default
    private SourceType sourceType = SourceType.CUSTOM;

    /** ID nguồn nếu clone từ venue/event khác */
    @Column(name = "source_id")
    private UUID sourceId;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @CreatedBy
    @Column(name = "created_by")
    private String createdBy;

    public enum SourceType {
        CUSTOM, CLONED_FROM_VENUE, CLONED_FROM_EVENT
    }
}
