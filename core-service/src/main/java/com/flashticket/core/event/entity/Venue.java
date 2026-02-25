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

/**
 * Venue Entity - event_schema.venues
 * Địa điểm tổ chức sự kiện
 */
@Entity
@Table(name = "venues", schema = "event_schema", indexes = {
        @Index(name = "idx_venues_city", columnList = "city"),
        @Index(name = "idx_venues_active", columnList = "is_active"),
        @Index(name = "idx_venues_slug", columnList = "slug")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Venue {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(columnDefinition = "TEXT")
    private String description;

    // Address Information
    @Column(nullable = false, columnDefinition = "TEXT")
    private String address;

    private String ward;
    private String district;

    @Column(nullable = false)
    private String city;

    private String country = "Vietnam";

    @Column(name = "postal_code", length = 20)
    private String postalCode;

    // Geo Location
    @Column(precision = 10, scale = 8)
    private BigDecimal latitude;

    @Column(precision = 11, scale = 8)
    private BigDecimal longitude;

    // Capacity & Facilities
    @Column(name = "total_capacity")
    private Integer totalCapacity;

    @Type(JsonType.class)
    @Column(columnDefinition = "jsonb")
    private List<String> facilities;

    // Media
    @Type(JsonType.class)
    @Column(name = "image_urls", columnDefinition = "jsonb")
    private List<String> imageUrls;

    // Contact
    @Column(name = "contact_phone", length = 20)
    private String contactPhone;

    @Column(name = "contact_email")
    private String contactEmail;

    @Column(name = "website_url", length = 500)
    private String websiteUrl;

    // Status
    @Column(name = "is_verified")
    private Boolean isVerified = false;

    @Column(name = "is_active")
    private Boolean isActive = true;

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
}
