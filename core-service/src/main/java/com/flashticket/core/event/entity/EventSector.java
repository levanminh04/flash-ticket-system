package com.flashticket.core.event.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "event_sectors", schema = "event_schema")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EventSector {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "layout_id", nullable = false)
    private EventLayout layout;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "code", length = 20)
    private String code;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "sector_type", nullable = false, length = 50)
    private String sectorType; 

    @Column(name = "total_capacity", nullable = false)
    private Integer totalCapacity;

    @Type(JsonType.class)
    @Column(name = "map_data", columnDefinition = "jsonb")
    private Map<String, Object> mapData;

    @Column(name = "color_code", length = 7)
    private String colorCode;

    @Column(name = "display_order")
    private Integer displayOrder = 0;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PrePersist
    void ensureId() {
        if (id == null) {
            id = UUID.randomUUID();
        }
    }
}
