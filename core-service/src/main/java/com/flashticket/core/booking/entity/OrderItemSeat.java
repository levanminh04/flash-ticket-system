package com.flashticket.core.booking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
    name = "order_item_seats",
    schema = "booking_schema",
    indexes = {
        @Index(name = "idx_order_item_seats_order_item", columnList = "order_item_id"),
        @Index(name = "idx_order_item_seats_seat", columnList = "seat_id")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderItemSeat {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "order_item_id", nullable = false)
    private UUID orderItemId;

    @Column(name = "seat_id", nullable = false)
    private UUID seatId;

    @Column(name = "seat_label", length = 20)
    private String seatLabel;

    @Column(name = "row_name", length = 10)
    private String rowName;

    @Column(name = "seat_number", length = 10)
    private String seatNumber;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal price;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    @Builder.Default
    private SeatReservationStatus status = SeatReservationStatus.RESERVED;

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public enum SeatReservationStatus {
        RESERVED, CONFIRMED, CANCELLED
    }
}
