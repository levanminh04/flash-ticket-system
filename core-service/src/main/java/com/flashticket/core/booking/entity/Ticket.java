package com.flashticket.core.booking.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Ticket Entity — booking_schema.tickets
 *
 * Tấm vé thực sự được cấp sau khi thanh toán thành công.
 * Mỗi record = 1 tấm vé cầm tay với QR code độc lập.
 *
 * Ví dụ: OrderItem quantity=2 → 2 Ticket records riêng biệt.
 *
 * QR Code Data format (HMAC-SHA256 signed):
 *   "{ticketCode}|{eventId}|{ticketTypeId}|{signature}"
 */
@Entity
@Table(
    name = "tickets",
    schema = "booking_schema",
    indexes = {
        @Index(name = "idx_tickets_code",   columnList = "ticket_code"),
        @Index(name = "idx_tickets_order",  columnList = "order_id"),
        @Index(name = "idx_tickets_event",  columnList = "event_id"),
        @Index(name = "idx_tickets_status", columnList = "status"),
        @Index(name = "idx_tickets_user",   columnList = "user_id")
    }
)
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * Mã vé public — hiển thị cho user, dùng để check-in.
     * Format: "TKT-{orderNumber}-{sequenceNumber}" e.g. "TKT-TB-20260219-001-001"
     */
    @Column(name = "ticket_code", nullable = false, unique = true, length = 100)
    private String ticketCode;

    // Parents — Order + OrderItem
    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "order_item_id")
    private UUID orderItemId;

    // User (LOGICAL REFERENCE — từ Keycloak subject claim)
    @Column(name = "user_id", nullable = false)
    private String userId;

    // Event & Ticket Type (LOGICAL REFERENCE — cross schema)
    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Column(name = "ticket_type_id", nullable = false)
    private UUID ticketTypeId;

    // Seat (null nếu là zone ticket, có giá trị nếu seat selection — logical ref tới event_seats)
    @Column(name = "seat_id")
    private UUID seatId;

    @Column(name = "seat_label", length = 20)
    private String seatLabel;

    // Denormalized — snapshot tại thời điểm cấp vé
    @Column(name = "event_title", length = 255)
    private String eventTitle;

    @Column(name = "event_start_datetime")
    private Instant eventStartDatetime;

    @Column(name = "event_venue_name", length = 255)
    private String eventVenueName;

    @Column(name = "event_venue_address", columnDefinition = "TEXT")
    private String eventVenueAddress;

    @Column(name = "ticket_type_name", length = 100)
    private String ticketTypeName;

    // Holder Information
    @Column(name = "holder_name", length = 255)
    private String holderName;

    @Column(name = "holder_email", length = 255)
    private String holderEmail;

    @Column(name = "holder_phone", length = 20)
    private String holderPhone;

    // Pricing — snapshot tại thời điểm cấp
    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal price;

    // QR Code
    /**
     * Dữ liệu thô của QR: "{ticketCode}|{eventId}|{ticketTypeId}|{hmacSignature}"
     * Được verify khi check-in bằng HMAC-SHA256.
     */
    @Column(name = "qr_code_data", columnDefinition = "TEXT")
    private String qrCodeData;

    /**
     * Optional: URL ảnh QR được lưu trên Cloudinary.
     * Nếu null → frontend phải render từ qrCodeData.
     */
    @Column(name = "qr_code_image_url", length = 500)
    private String qrCodeImageUrl;

    // Check-in Status
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private TicketStatus status = TicketStatus.VALID;

    @Column(name = "checked_in_at")
    private Instant checkedInAt;

    @Column(name = "checked_in_by", length = 255)
    private String checkedInBy;

    @Column(name = "check_in_location", length = 255)
    private String checkInLocation;

    // Transfer support
    @Column(name = "is_transferable")
    private Boolean isTransferable = true;

    @Column(name = "transferred_from_ticket_id")
    private UUID transferredFromTicketId;

    @Column(name = "transferred_at")
    private Instant transferredAt;

    // Audit
    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;

    public enum TicketStatus {
        VALID,       // Vé hợp lệ, chưa dùng
        USED,        // Đã check-in
        CANCELLED,   // Bị hủy (refund order)
        TRANSFERRED  // Đã chuyển nhượng
    }
}
