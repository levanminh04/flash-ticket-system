package com.flashticket.core.event.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * TicketType Entity - event_schema.ticket_types
 * Loại vé của mỗi sự kiện (VIP, Regular, Early Bird, etc.)
 */
@Entity
@Table(name = "ticket_types", schema = "event_schema", indexes = {
        @Index(name = "idx_ticket_types_event", columnList = "event_id"),
        @Index(name = "idx_ticket_types_event_sector", columnList = "event_sector_id"),
        @Index(name = "idx_ticket_types_available", columnList = "quantity_available")
})
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TicketType {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    // Parent Event — @JsonIgnore để tránh circular reference - VÒNG LẶP VÔ TẬN:
    // EventImage → event → ticketTypes → TicketType → event → ticketTypes → TicketType → event → ... → ∞
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    // Event Sector (optional — per-event sector tùy biến bởi Organizer)
    @Column(name = "event_sector_id")
    private UUID eventSectorId;

    @Enumerated(EnumType.STRING)
    @Column(name = "inventory_mode", nullable = false, length = 50)
    @Builder.Default
    private InventoryMode inventoryMode = InventoryMode.QUANTITY;

    @Enumerated(EnumType.STRING)
    @Column(name = "access_scope", nullable = false, length = 50)
    @Builder.Default
    private AccessScope accessScope = AccessScope.EVENT;

    // Basic Information
    @Column(nullable = false, length = 100)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    // Pricing
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal price;

    @Column(name = "original_price", precision = 15, scale = 2)
    private BigDecimal originalPrice;

    private String currency = "VND";

    // Inventory Management
    @Column(name = "quantity_total", nullable = false)
    private Integer quantityTotal;

    @Column(name = "quantity_available", nullable = false)
    private Integer quantityAvailable;

    @Column(name = "quantity_reserved")
    private Integer quantityReserved = 0;

    @Column(name = "max_per_order")
    private Integer maxPerOrder = 10;

    // Seat Selection
    @Column(name = "seat_selection_enabled")
    private Boolean seatSelectionEnabled = false;

    // Sales Window
    @Column(name = "sale_start_datetime")
    private Instant saleStartDatetime;

    @Column(name = "sale_end_datetime")
    private Instant saleEndDatetime;

    // Display
    @Column(name = "display_order")
    private Integer displayOrder = 0;

    @Column(name = "color_code", length = 7)
    private String colorCode;

    // Status
    @Enumerated(EnumType.STRING)
    @Column(length = 50)
    private TicketStatus status = TicketStatus.ACTIVE;

    @Column(name = "is_visible")
    private Boolean isVisible = true;

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

    public enum TicketStatus {
        ACTIVE, SOLD_OUT, HIDDEN
    }

    public enum InventoryMode {
        QUANTITY, ASSIGNED_SEAT
    }

    public enum AccessScope {
        EVENT, SECTOR
    }
}
