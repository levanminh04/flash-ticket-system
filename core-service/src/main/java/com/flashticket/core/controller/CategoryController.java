package com.flashticket.core.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/categories")
public class CategoryController {

    @GetMapping
    public ResponseEntity<?> getAllCategories() {
        // Trả về dữ liệu mẫu (mock data) theo đúng chuẩn tài liệu API của nhóm
        Map<String, Object> response = Map.of(
            "success", true,
            "data", List.of(
                Map.of("id", "cat-uuid-1", "name", "Âm nhạc", "slug", "am-nhac"),
                Map.of("id", "cat-uuid-2", "name", "Sân khấu & Nghệ thuật", "slug", "san-khau-nghe-thuat")
            )
        );
        return ResponseEntity.ok(response);
    }
}