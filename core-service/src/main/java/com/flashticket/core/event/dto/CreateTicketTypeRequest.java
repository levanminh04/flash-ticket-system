package com.flashticket.core.event.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Request tao/sua TicketType.
 *
 * quantityTotal duoc validate trong service theo inventoryMode backend tu derive:
 * - QUANTITY: bat buoc >= 1
 * - ASSIGNED_SEAT: bo qua gia tri client gui, lay tu so ghe active da gan vao TicketType
 */
@Builder
public record CreateTicketTypeRequest(

    @NotBlank(message = "Ten loai ve khong duoc de trong")
    @Size(max = 100)
    String name,

    String description,

    @NotNull(message = "Gia ve khong duoc de trong")
    @DecimalMin(value = "0.0", inclusive = true, message = "Gia ve khong duoc am")
    BigDecimal price,

    BigDecimal originalPrice,

    Integer quantityTotal,

    @Min(value = 1, message = "So ve toi da moi lan mua toi thieu la 1")
    @Max(value = 20, message = "So ve toi da moi lan mua la 20")
    Integer maxPerOrder,

    Instant saleStartDatetime,
    Instant saleEndDatetime,

    /**
     * Deprecated compatibility flag. Backend derives it from inventoryMode.
     */
    Boolean seatSelectionEnabled,

    /** Mau hien thi tren Frontend: "#FF5733" */
    @Size(max = 7)
    @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Mau ve phai dung dinh dang #RRGGBB")
    String colorCode,

    Integer displayOrder,

    /**
     * null -> event-level general admission.
     * non-null -> sector-level ticket, backend derives mode from sectorType.
     */
    UUID eventSectorId,

    Boolean isVisible

) {}
