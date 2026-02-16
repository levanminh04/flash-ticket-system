package com.flashticket.core.event.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;


@Entity
@Table(name = "events", schema = "event_schema", indexes = {
        @Index(name = "idx_events_venue", columnList = "venue_id"),
        @Index(name = "idx_events_organizer", columnList = "organizer_id"),
        @Index(name = "idx_events_status", columnList = "status"),
        @Index(name = "idx_events_datetime", columnList = "start_datetime"),
        @Index(name = "idx_events_featured", columnList = "is_featured"),
        @Index(name = "idx_events_slug", columnList = "slug")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Basic Information
    @Column(nullable = false)
    private String title;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(name = "short_description", length = 500)
    private String shortDescription;

    @Column(columnDefinition = "TEXT")
    private String description;

    // Tags for search
    @Type(JsonType.class)
    @Column(columnDefinition = "jsonb")
    private List<String> tags;

    // Schedule
    @Column(name = "start_datetime", nullable = false)
    private Instant startDatetime;

    @Column(name = "end_datetime", nullable = false)
    private Instant endDatetime;

    private String timezone = "Asia/Ho_Chi_Minh";

    // Location
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "venue_id")
    private Venue venue;

    @Column(name = "online_event_url", length = 500)
    private String onlineEventUrl;

    @Column(name = "is_online")
    private Boolean isOnline = false;

    // Organizer (LOGICAL REFERENCE - user ở MongoDB)
    @Column(name = "organizer_id", nullable = false)
    private String organizerId;

    @Column(name = "organizer_name")
    private String organizerName;

    @Column(name = "organizer_logo_url", length = 500)
    private String organizerLogoUrl;

    // Ticket Configuration
    @Column(name = "min_tickets_per_order")
    private Integer minTicketsPerOrder = 1;

    @Column(name = "max_tickets_per_order")
    private Integer maxTicketsPerOrder = 10;

    // Sales Window
    @Column(name = "sale_start_datetime")
    private Instant saleStartDatetime;

    @Column(name = "sale_end_datetime")
    private Instant saleEndDatetime;

    // Status & Visibility
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private EventStatus status = EventStatus.DRAFT;

    @Enumerated(EnumType.STRING)
    @Column(length = 50)
    private EventVisibility visibility = EventVisibility.PUBLIC;

    @Column(name = "is_featured")
    private Boolean isFeatured = false;

    // Statistics (denormalized)
    @Column(name = "total_capacity")
    private Integer totalCapacity = 0;

    @Column(name = "tickets_sold")
    private Integer ticketsSold = 0;

    @Column(name = "view_count")
    private Integer viewCount = 0;

    // SEO
    @Column(name = "meta_title")
    private String metaTitle;

    @Column(name = "meta_description", length = 500)
    private String metaDescription;

    @Column(name = "meta_keywords")
    private String metaKeywords;

    // Audit fields
    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @CreatedBy
    @Column(name = "created_by")
    private String createdBy;

    @LastModifiedBy
    @Column(name = "updated_by")
    private String updatedBy;

    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    // Denormalized fields (for performance optimization)
    /**
     * Cache của MIN(ticket_types.price)
     * Update khi tạo/sửa/xóa TicketType
     */
    @Column(name = "min_price", precision = 15, scale = 2)
    private BigDecimal minPrice;
    
    /**
     * Cache của event_images (type=BANNER, is_primary=true).image_url
     * Update khi upload/delete banner image
     */
    @Column(name = "banner_url", length = 500)
    private String bannerUrl;

    // Relationships
    
    /**
     * Many-to-Many relationship với event_schema.event_categories
     */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "event_categories",
        schema = "event_schema",
        joinColumns = @JoinColumn(name = "event_id"),
        inverseJoinColumns = @JoinColumn(name = "category_id")
    )
    private List<Category> categories;

    /**
     * One-to-Many relationship với TicketType
     * Dùng cho price range filter
     */
    @OneToMany(mappedBy = "event", fetch = FetchType.LAZY)
    private List<TicketType> ticketTypes;
    
    /**
     * One-to-Many relationship với EventImage
     * Dùng cho image gallery
     */
    @OneToMany(mappedBy = "event", fetch = FetchType.LAZY)
    private List<EventImage> images;

    // Enums
    public enum EventStatus {
        DRAFT, PUBLISHED, CANCELLED, COMPLETED, SOLD_OUT
    }

    public enum EventVisibility {
        PUBLIC, PRIVATE, UNLISTED
    }
}
