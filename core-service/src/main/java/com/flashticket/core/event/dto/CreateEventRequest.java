package com.flashticket.core.event.dto;

import jakarta.validation.constraints.*;
import lombok.Builder;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Request body cho POST /api/organizer/events
 *
 * Slug tự động sinh từ title — không nhận từ client.
 * Organizer chỉ cần cung cấp thông tin nội dung,
 * hệ thống sẽ xử lý slugification và uniqueness.
 */
@Builder
public record CreateEventRequest(

    @NotBlank(message = "Tiêu đề sự kiện không được để trống")
    @Size(max = 255, message = "Tiêu đề tối đa 255 ký tự")
    String title,

    @Size(max = 500, message = "Mô tả ngắn tối đa 500 ký tự")
    String shortDescription,

    String description,

    List<String> tags,

    // --- Lịch trình ---
    @NotNull(message = "Thời gian bắt đầu không được để trống")
    Instant startDatetime,

    @NotNull(message = "Thời gian kết thúc không được để trống")
    Instant endDatetime,

    @Size(max = 50)
    String timezone,

    // --- Địa điểm ---
    UUID venueId,

    Boolean isOnline,

    @Size(max = 500)
    String onlineEventUrl,

    // --- Phân loại ---
    List<UUID> categoryIds,

    // --- Cửa sổ bán vé ---
    Instant saleStartDatetime,
    Instant saleEndDatetime,

    // --- Cấu hình ---
    @Min(value = 1, message = "Số vé tối thiểu mỗi đơn phải >= 1")
    Integer minTicketsPerOrder,

    @Max(value = 100, message = "Số vé tối đa mỗi đơn phải <= 100")
    Integer maxTicketsPerOrder,

    /**
     * PUBLIC / PRIVATE / UNLISTED
     * Mặc định PUBLIC nếu không truyền.
     */
    String visibility,

    // --- SEO ---
    @Size(max = 255)
    String metaTitle,

    @Size(max = 500)
    String metaDescription,

    @Size(max = 255)
    String metaKeywords

) {}
