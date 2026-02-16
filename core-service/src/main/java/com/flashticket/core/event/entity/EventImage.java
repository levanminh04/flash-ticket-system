package com.flashticket.core.event.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * EventImage Entity - event_schema.event_images
 * Lưu metadata của images được upload lên Cloudinary
 */
@Entity
@Table(name = "event_images", schema = "event_schema", indexes = {
    @Index(name = "idx_event_images_event", columnList = "event_id"),
    @Index(name = "idx_event_images_type_primary", columnList = "event_id, image_type, is_primary")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EventImage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Relationship
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    // Cloudinary metadata
    @Column(name = "image_url", nullable = false, length = 500)
    private String imageUrl;  // Cloudinary secure_url

    @Column(name = "public_id", length = 255)
    private String publicId;  // Cloudinary public_id (for deletion)

    // Image metadata
    @Enumerated(EnumType.STRING)
    @Column(name = "image_type", nullable = false, length = 50)
    private ImageType imageType;

    @Column(name = "alt_text", length = 255)
    private String altText;  // SEO alt text

    @Column(name = "display_order")
    private Integer displayOrder = 0;

    @Column(name = "width")
    private Integer width;

    @Column(name = "height")
    private Integer height;

    @Column(name = "file_size_bytes")
    private Long fileSizeBytes;

    @Column(name = "is_primary")
    private Boolean isPrimary = false;  // Ảnh chính (banner)

    // Audit fields
    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @CreatedBy
    @Column(name = "created_by")
    private String createdBy;

    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;

    // Enum
    public enum ImageType {
        BANNER,      // Ảnh banner chính (1200x800)
        POSTER,      // Poster event
        SEAT_MAP,    // Sơ đồ chỗ ngồi
        GALLERY,     // Ảnh gallery
        THUMBNAIL    // Thumbnail nhỏ
    }
}
