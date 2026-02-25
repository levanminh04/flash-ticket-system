package com.flashticket.core.booking.controller;

import com.flashticket.core.booking.dto.TicketResponse;
import com.flashticket.core.booking.entity.Ticket;
import com.flashticket.core.booking.repository.TicketRepository;
import com.flashticket.core.booking.service.TicketIssuanceService;
import com.flashticket.core.common.exception.InvalidRequestException;
import com.flashticket.core.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * TicketController — Endpoints xem vé và check-in.
 *
 * API Design:
 *   GET  /api/tickets/my-tickets         → Tất cả vé của tôi
 *   GET  /api/tickets/{id}               → Chi tiết 1 vé (có qrCodeData)
 *   POST /api/tickets/checkin            → Check-in bằng QR data (ORGANIZER role)
 */
@RestController
@RequiredArgsConstructor
@Slf4j
public class TicketController {

    private final TicketRepository ticketRepository;
    private final TicketIssuanceService ticketIssuanceService;

    /**
     * GET /api/tickets/my-tickets — Danh sách vé của user.
     * Trả về summary — không bao gồm qrCodeData để tránh payload lớn.
     */
    @GetMapping("/api/tickets/my-tickets")
    public ResponseEntity<Page<TicketResponse>> getMyTickets(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size
    ) {
        String userId = jwt.getSubject();
        size = Math.min(size, 50);

        Page<Ticket> tickets = ticketRepository.findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(
            userId, PageRequest.of(page, size));

        return ResponseEntity.ok(tickets.map(TicketResponse::from));
    }

    /**
     * GET /api/tickets/{id} — Chi tiết vé đầy đủ, bao gồm qrCodeData.
     * IDOR protected — chỉ user sở hữu vé mới xem được.
     */
    @GetMapping("/api/tickets/{id}")
    public ResponseEntity<TicketResponse> getTicketDetail(
        @PathVariable UUID id,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String userId = jwt.getSubject();
        Ticket ticket = ticketRepository.findByIdAndUserIdAndIsDeletedFalse(id, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Vé không tồn tại hoặc không thuộc về bạn"));

        return ResponseEntity.ok(TicketResponse.from(ticket));
    }

    /**
     * POST /api/tickets/checkin — Check-in vé (dành cho BAN TỔ CHỨC).
     *
     * Request body: { "qrData": "TKT-...|...|...|signature", "location": "Gate 1" }
     *
     * Quy trình:
     * 1. Parse và verify HMAC signature của QR
     * 2. Kiểm tra trạng thái vé (VALID / USED)
     * 3. Đánh dấu USED + ghi nhận thời gian check-in
     */
    @PostMapping("/api/tickets/checkin")
    public ResponseEntity<Map<String, Object>> checkIn(
        @RequestBody CheckInRequest request,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String checkedInBy = jwt.getSubject(); // là người gác cổng / nhân viên BTC — cầm thiết bị scan QR và gọi API.

        Ticket ticket = ticketIssuanceService.validateAndCheckIn(
            request.qrData(),
            checkedInBy,
            request.location()
        );

        log.info("Ticket {} checked in by {} at {}",
            ticket.getTicketCode(), checkedInBy, ticket.getCheckInLocation());

        return ResponseEntity.ok(Map.of(
            "success", true,
            "ticketCode", ticket.getTicketCode(),
            "holderName", ticket.getHolderName(),
            "ticketTypeName", ticket.getTicketTypeName(),
            "seatLabel", ticket.getSeatLabel() != null ? ticket.getSeatLabel() : "Zone",
            "checkedInAt", ticket.getCheckedInAt()
        ));
    }

    /** Request record cho check-in */
    public record CheckInRequest(
            String qrData,
            String location) {}
}
