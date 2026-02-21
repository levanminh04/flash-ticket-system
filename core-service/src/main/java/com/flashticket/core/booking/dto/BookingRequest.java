package com.flashticket.core.booking.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.util.List;
import java.util.UUID;

/**
 * Request body cho POST /api/bookings
 *
 * Thiết kế 1 API duy nhất cho cả Zone và Seated ticket:
 * - Zone ticket: items[].seatIds = null hoặc empty
 * - Seated ticket: items[].seatIds = [seatId1, seatId2] (Phase 2D)
 */
public record BookingRequest(

    @NotNull(message = "eventId là bắt buộc")
    UUID eventId,

    @NotEmpty(message = "Phải có ít nhất 1 loại vé")
    @Valid
    List<BookingItemRequest> items,

    @NotBlank(message = "Tên khách hàng là bắt buộc")
    @Size(max = 255)
    String customerName,

    @NotBlank(message = "Email là bắt buộc")
    @Email(message = "Email không hợp lệ")
    @Size(max = 255)
    String customerEmail,

    @Pattern(regexp = "^(\\+84|0)[0-9]{8,10}$", message = "Số điện thoại không hợp lệ")
    String customerPhone,

    /** Optional: mã voucher — null nếu không có */
    @Size(max = 50)
    String promotionCode,

    @Size(max = 500)
    String customerNote

) {

    /**
     * Chi tiết 1 dòng trong request — 1 loại vé + số lượng.
     *
     * Ví dụ Zone ticket:   { "ticketTypeId": "...", "quantity": 2 }
     * Ví dụ Seated ticket: { "ticketTypeId": "...", "quantity": 1, "seatIds": ["seat-uuid"] }
     */
    public record BookingItemRequest(

        @NotNull(message = "ticketTypeId là bắt buộc")
        UUID ticketTypeId,

        @NotNull
        @Min(value = 1, message = "Số lượng tối thiểu là 1")
        @Max(value = 20, message = "Số lượng tối đa là 20 mỗi loại")
        Integer quantity,

        /**
         * Danh sách ghế cụ thể — null cho Zone ticket.
         * Khi có giá trị → server xử lý theo Seated mode (Phase 2D).
         * Số phần tử phải bằng quantity nếu được cung cấp.
         */
        List<UUID> seatIds

    ) {}
}
