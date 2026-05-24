package com.flashticket.core.event.entity;

import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "event_seats", schema = "event_schema")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EventSeat {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sector_id", nullable = false)
    private EventSector sector;

    @Column(name = "ticket_type_id")
    private UUID ticketTypeId;

    @Column(name = "row_name", nullable = false, length = 10)
    private String rowName;

    @Column(name = "seat_number", nullable = false, length = 10)
    private String seatNumber;

    @Column(name = "seat_label", length = 20)
    private String seatLabel;

    @Column(name = "coord_x", nullable = false, precision = 10, scale = 2)
    private BigDecimal coordX;

    @Column(name = "coord_y", nullable = false, precision = 10, scale = 2)
    private BigDecimal coordY;

    @Type(JsonType.class)
    @Column(name = "coord_metadata", columnDefinition = "jsonb")
    private Map<String, Object> coordMetadata;

    @Column(name = "seat_type", length = 50)
    private String seatType = "REGULAR";

    @Column(name = "color_code", length = 7)
    private String colorCode;

    @Column(name = "is_aisle")
    private Boolean isAisle = false;

    @Column(name = "has_obstruction")
    private Boolean hasObstruction = false;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
