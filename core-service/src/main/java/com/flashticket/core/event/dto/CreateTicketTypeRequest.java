package com.flashticket.core.event.dto;

import com.flashticket.core.event.entity.TicketType.TicketStatus;
import jakarta.validation.constraints.*;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Request để tạo mới TicketType.
 * eventSectorId: null = Zone ticket, có giá trị = Block/Seated ticket.
 */
@Builder
public record CreateTicketTypeRequest(

    @NotBlank(message = "Tên loại vé không được để trống")
    @Size(max = 100)
    String name,

    String description,

    @NotNull(message = "Giá vé không được để trống")
    @DecimalMin(value = "0.0", inclusive = true, message = "Giá vé không được âm")
    BigDecimal price,

    BigDecimal originalPrice,

    @NotNull(message = "Tổng số lượng vé không được để trống")
    @Min(value = 1, message = "Số lượng vé tối thiểu là 1")
    Integer quantityTotal,

    @Min(value = 1, message = "Số vé tối đa mỗi lần mua tối thiểu là 1")
    @Max(value = 20, message = "Số vé tối đa mỗi lần mua là 20")
    Integer maxPerOrder,

    Instant saleStartDatetime,
    Instant saleEndDatetime,

    /**
     * true → Seated ticket (Phase 2D), user phải chọn ghế.
     * false → Zone/Block ticket, chỉ cần chọn số lượng.
     */
    Boolean seatSelectionEnabled,

    /** Màu hiển thị trên Frontend: "#FF5733" */
    @Size(max = 7)
    String colorCode,

    Integer displayOrder,

    /**
     * Gắn loại vé vào khu vực cụ thể (event_sectors).
     * null → Zone ticket không thuộc sector nào.
     */
    UUID eventSectorId,

    Boolean isVisible

) {}
