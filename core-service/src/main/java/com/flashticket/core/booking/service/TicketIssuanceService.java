package com.flashticket.core.booking.service;

import com.flashticket.core.booking.entity.Order;
import com.flashticket.core.booking.entity.OrderItem;
import com.flashticket.core.booking.entity.Ticket;
import com.flashticket.core.booking.repository.OrderItemRepository;
import com.flashticket.core.booking.repository.OrderRepository;
import com.flashticket.core.booking.repository.TicketRepository;
import com.flashticket.core.common.exception.InvalidRequestException;
import com.flashticket.core.common.exception.ResourceNotFoundException;
import com.flashticket.core.event.repository.EventRepository;
import com.flashticket.core.event.repository.TicketTypeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

/**
 * TicketIssuanceService — Cấp vé sau khi thanh toán thành công.
 *
 * Được gọi bởi PaymentService sau khi xác nhận IPN từ VNPay.
 *
 * QR Code Data format (HMAC-SHA256 signed):
 *   "{ticketCode}|{eventId}|{ticketTypeId}|{hmacSignature}"
 *
 * Tại sao phải ký?
 * - QR code thuần túy chứa ticketCode dễ bị giả mạo (brute force mã)
 * - HMAC chứng minh QR được tạo bởi server có secret key
 * - Khi check-in, chỉ cần verify signature — không cần query DB
 *   (giảm latency check-in khi queue dài)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TicketIssuanceService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final TicketRepository ticketRepository;
    private final EventRepository eventRepository;
    private final TicketTypeRepository ticketTypeRepository;

    @Value("${app.qr.secret-key}")
    private String qrSecretKey;

    /**
     * Issue tickets cho 1 order — entry point.
     *
     * Idempotent: nếu tickets đã được cấp, return luôn danh sách đã có.
     * PaymentService gọi method này sau khi IPN confirmed.
     *
     * @param orderId ID của order đã CONFIRMED
     * @return Danh sách tickets được cấp
     */
    @Transactional
    public List<Ticket> issueTickets(UUID orderId) {
        Order order = orderRepository.findById(orderId)
            .orElseThrow(() -> new ResourceNotFoundException("Order không tồn tại: " + orderId));

        // Idempotency: nếu tickets đã được cấp → return ngay
        long existingCount = ticketRepository.countByOrderIdAndIsDeletedFalse(orderId);
        if (existingCount > 0) {
            log.warn("Tickets already issued for order {}. Returning existing.", order.getOrderNumber());
            return ticketRepository.findByOrderIdAndIsDeletedFalse(orderId);
        }

        // Chỉ cấp vé cho order CONFIRMED
        if (order.getStatus() != Order.OrderStatus.CONFIRMED) {
            throw new InvalidRequestException(
                "Chỉ có thể cấp vé cho đơn hàng đã thanh toán. Trạng thái: " + order.getStatus());
        }

        List<OrderItem> items = orderItemRepository.findByOrderId(orderId);
        List<Ticket> allTickets = new ArrayList<>();
        int sequenceNumber = 1;

        for (OrderItem item : items) {
            // Lấy tên ticket type và event info nếu chưa có trên order item
            String ticketTypeName = item.getTicketTypeName();
            String venueName = order.getEventVenueName();

            // Loop tạo ticket cho từng vé trong quantity
            for (int i = 0; i < item.getQuantity(); i++) {
                String ticketCode = buildTicketCode(order.getOrderNumber(), sequenceNumber++);
                String qrData = buildSignedQrData(ticketCode, order.getEventId(), item.getTicketTypeId());

                Ticket ticket = Ticket.builder()
                    .ticketCode(ticketCode)
                    .orderId(order.getId())
                    .orderItemId(item.getId())
                    .userId(order.getUserId())
                    .eventId(order.getEventId())
                    .ticketTypeId(item.getTicketTypeId())
                    // Seated: seatId/seatLabel được set bởi SeatBookingStrategy (Phase 2D)
                    .seatId(null)
                    .seatLabel(null)
                    .eventTitle(order.getEventTitle())
                    .eventStartDatetime(order.getEventStartDatetime())
                    .eventVenueName(venueName)
                    .ticketTypeName(ticketTypeName)
                    .holderName(order.getCustomerName())
                    .holderEmail(order.getCustomerEmail())
                    .holderPhone(order.getCustomerPhone())
                    .price(item.getUnitPrice())
                    .qrCodeData(qrData)
                    .status(Ticket.TicketStatus.VALID)
                    .isDeleted(false)
                    .isTransferable(true)
                    .build();

                allTickets.add(ticket);
            }
        }

        List<Ticket> saved = ticketRepository.saveAll(allTickets);

        // Update tickets_sold counter trên event
        int totalTickets = items.stream().mapToInt(OrderItem::getQuantity).sum();
        eventRepository.findByIdAndIsDeletedFalse(order.getEventId()).ifPresent(event -> {
            event.setTicketsSold(event.getTicketsSold() + totalTickets);
            eventRepository.save(event);
        });

        // Giảm quantity_reserved sau khi tickets được cấp
        items.forEach(item ->
            ticketTypeRepository.decrementReserved(item.getTicketTypeId(), item.getQuantity()));

        log.info("Issued {} tickets for order {} (event: {})",
            saved.size(), order.getOrderNumber(), order.getEventTitle());

        return saved;
    }

    /**
     * Validate QR data khi check-in.
     *
     * @param qrData  QR data được scan từ vé
     * @return Ticket nếu hợp lệ
     * @throws InvalidRequestException nếu QR không hợp lệ hoặc vé đã được dùng
     */

    @Transactional
    public Ticket validateAndCheckIn(String qrData, String checkedInBy, String location) {

        // 1. Parse QR, Format: "{ticketCode}|{eventId}|{ticketTypeId}|{signature}"
        String[] parts = qrData.split("\\|");
        if (parts.length != 4) {
            throw new InvalidRequestException("QR code không hợp lệ");
        }
        String ticketCode = parts[0];
        UUID eventId;
        UUID ticketTypeId;
        String signature = parts[3];
        try {
            eventId = UUID.fromString(parts[1]);
            ticketTypeId = UUID.fromString(parts[2]);
        } catch (IllegalArgumentException e) {
            throw new InvalidRequestException("QR code không hợp lệ");
        }

        // 2. Verify signature
        String expectedPayload = ticketCode + "|" + eventId + "|" + ticketTypeId;
        String expectedSig = hmacSha256(expectedPayload, qrSecretKey);
        if (!expectedSig.equals(signature)) {
            log.warn("Invalid QR signature for ticket: {}", ticketCode);
            throw new InvalidRequestException("QR code đã bị chỉnh sửa hoặc giả mạo");
        }

        // 3. Load ticket
        Ticket ticket = ticketRepository.findByTicketCodeAndIsDeletedFalse(ticketCode)
            .orElseThrow(() -> new InvalidRequestException("Vé không tồn tại trong hệ thống"));

        // 4. Check status
        if (ticket.getStatus() == Ticket.TicketStatus.USED) {
            throw new InvalidRequestException(
                "Vé đã được sử dụng lúc " + ticket.getCheckedInAt());
        }
        if (ticket.getStatus() != Ticket.TicketStatus.VALID) {
            throw new InvalidRequestException("Vé không hợp lệ (trạng thái: " + ticket.getStatus() + ")");
        }

        // Mark as USED
        ticket.setStatus(Ticket.TicketStatus.USED);
        ticket.setCheckedInAt(java.time.Instant.now());
        ticket.setCheckedInBy(checkedInBy);
        ticket.setCheckInLocation(location);

        return ticketRepository.save(ticket);
    }

    // ══ PRIVATE ═══════════════════════════════════════════════════════════════

    /**
     * Build ticket code — format: "TKT-{orderNumber}-{3digit-seq}"
     * Ví dụ: "TKT-TB-20260219-482931-001"
     */
    private String buildTicketCode(String orderNumber, int seq) {
        return String.format("TKT-%s-%03d", orderNumber, seq);
    }

    /**
     * Build HMAC-SHA256 signed QR data.
     *
     * Format: "{ticketCode}|{eventId}|{ticketTypeId}|{signature}"
     * Signature = HMAC-SHA256(payload, secretKey) in hex
     * Signature = HMAC-SHA256(Dữ liệu vé, Secret Key)
     */
    private String buildSignedQrData(String ticketCode, UUID eventId, UUID ticketTypeId) {
        String payload = ticketCode + "|" + eventId + "|" + ticketTypeId;
        String signature = hmacSha256(payload, qrSecretKey);
        return payload + "|" + signature;
    }

    /**
     * HMAC-SHA256 computation.
     * Thread-safe: Mac instance được tạo mới mỗi lần gọi.
     */
    private String hmacSha256(String data, String key) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(
                key.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKey);
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException("Không thể tạo HMAC signature", e);
        }
    }
}
