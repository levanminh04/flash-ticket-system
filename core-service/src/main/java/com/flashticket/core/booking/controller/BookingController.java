package com.flashticket.core.booking.controller;

import com.flashticket.core.booking.dto.*;
import com.flashticket.core.booking.service.BookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * BookingController — Endpoints quản lý đơn hàng.
 *
 * Tất cả endpoints yêu cầu JWT — user_id lấy từ JWT subject claim.
 *
 * API :
 *   POST   /api/bookings              → Tạo đơn hàng (Zone ticket)
 *   GET    /api/orders/my-orders      → Danh sách đơn hàng của tôi
 *   GET    /api/orders/{id}           → Chi tiết 1 đơn hàng
 *   DELETE /api/orders/{id}           → Hủy đơn hàng (PENDING only)
 */
@RestController
@RequiredArgsConstructor
@Slf4j
public class BookingController {

    private final BookingService bookingService;

    /**
     * POST /api/bookings — Tạo đơn hàng mới.
     *
     * Flow:
     * 1. Validate JWT → extract userId
     * 2. BookingService.createBooking() — validate, lock, decrement, create order
     * 3. Return 201 Created + BookingResponse
     *
     * Response bao gồm orderId để frontend gọi tiếp /api/payments/create-url
     */
    @PostMapping("/api/bookings")
    public ResponseEntity<BookingResponse> createBooking(
        @Valid @RequestBody BookingRequest request,
        @AuthenticationPrincipal Jwt jwt // Khi một request gửi kèm JWT token đến server, sau khi authen author thì save JwtAuthenticationToken vào SecurityContextHolder, keycloak mặc định Principal là object Jwt và  subject là (User ID).
    ) {
        String userId = jwt.getSubject();
        log.info("Booking request from user {} for event {}", userId, request.eventId());

        BookingResponse response = bookingService.createBooking(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    /**
     * GET /api/orders/my-orders — Danh sách orders của user hiện tại.
     */
    @GetMapping("/api/orders/my-orders")
    public ResponseEntity<Page<OrderSummaryDTO>> getMyOrders(
        @AuthenticationPrincipal Jwt jwt,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "10") int size
    ) {
        String userId = jwt.getSubject();
        size = Math.min(size, 50); // Giới hạn tối đa 50/page

        Page<OrderSummaryDTO> orders = bookingService.getMyOrders(
            userId,
            PageRequest.of(page, size, Sort.by("createdAt").descending())
        );
        return ResponseEntity.ok(orders);
    }

    /**
     * GET /api/orders/{id} — Chi tiết 1 order.
     * chỉ trả về nếu order thuộc về current user.
     */
    @GetMapping("/api/orders/{id}")
    public ResponseEntity<OrderDetailResponse> getOrderDetail(
        @PathVariable UUID id,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String userId = jwt.getSubject();
        OrderDetailResponse response = bookingService.getOrderDetail(id, userId);
        return ResponseEntity.ok(response);
    }

    /**
     * DELETE /api/orders/{id} — Hủy đơn hàng.
     * Chỉ hủy được khi status = PENDING.
     * Stock sẽ được restore tự động.
     */
    @DeleteMapping("/api/orders/{id}")
    public ResponseEntity<Void> cancelOrder(
        @PathVariable UUID id,
        @AuthenticationPrincipal Jwt jwt
    ) {
        String userId = jwt.getSubject();
        bookingService.cancelOrder(id, userId);
        return ResponseEntity.noContent().build(); // 204 No Content
    }
}
