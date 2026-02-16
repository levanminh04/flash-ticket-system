package com.flashticket.core.event.dto;

import com.flashticket.core.event.entity.Category;

import java.util.UUID;

/**
 * Category Response DTO
 * Dùng cho API GET /api/categories
 */
public record CategoryResponse(
    UUID id,
    String name,
    String slug,
    String iconUrl,
    UUID parentId,
    Integer displayOrder
) {
    /**
     * static: không cần tạo object CategoryResponse để gọi phương thức from() này mà có thể gọi trực tiếp bằng tên class.
     */
    public static CategoryResponse from(Category category) {
        return new CategoryResponse(
            category.getId(),
            category.getName(),
            category.getSlug(),
            category.getIconUrl(),
            category.getParent() != null ? category.getParent().getId() : null,
            category.getDisplayOrder()
        );
    }
}

// category.getParent() != null ? category.getParent().getId() : null,
// mỗi Category trong danh sách, nó lại bắn thêm 1 câu SELECT để tìm Parent tương ứng.
// => N+1 query problem (chỉ xảy ra khi đang đặt LAZY fetch type)