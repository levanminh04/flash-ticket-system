package com.flashticket.core.event.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.UUID;

/**
 * Category Entity - event_schema.categories
 * Danh mục sự kiện: Concert, Workshop, Sport, Theater, etc.
 */
@Entity
@Table(name = "categories", schema = "event_schema", indexes = {
        @Index(name = "idx_categories_parent", columnList = "parent_id"),
        @Index(name = "idx_categories_active", columnList = "is_active"),
        @Index(name = "idx_categories_slug", columnList = "slug")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, unique = true, length = 100)
    private String slug;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "icon_url", length = 500)
    private String iconUrl;

    @Column(name = "display_order")
    private Integer displayOrder = 0;

    @Column(name = "is_active")
    private Boolean isActive = true;

    // Self-referencing for hierarchical categories
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private Category parent;

    // Audit fields
    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @CreatedBy
    @Column(name = "created_by", length = 255)
    private String createdBy;

    @LastModifiedBy
    @Column(name = "updated_by", length = 255)
    private String updatedBy;

    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;
}
