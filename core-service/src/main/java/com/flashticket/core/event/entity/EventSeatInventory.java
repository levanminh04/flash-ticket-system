package com.flashticket.core.event.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "event_seat_inventory", schema = "event_schema", indexes = {
    @Index(name = "idx_seat_inventory_event", columnList = "event_id"),
    @Index(name = "idx_seat_inventory_event_seat", columnList = "event_seat_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EventSeatInventory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "event_seat_id", nullable = false)
    private EventSeat eventSeat;

    @Column(name = "ticket_type_id")
    private UUID ticketTypeId;

    @Column(length = 50, nullable = false)
    private String status; // AVAILABLE, LOCKED, RESERVED, SOLD, BLOCKED

    @Column(name = "ticket_id")
    private UUID ticketId; // -- Reference tới tickets

    @Column(name = "order_id")
    private UUID orderId;

    @Column(name = "locked_by_user_id")
    private String userId;

    @Column(name = "lock_expires_at")
    private Instant lockExpiresAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
