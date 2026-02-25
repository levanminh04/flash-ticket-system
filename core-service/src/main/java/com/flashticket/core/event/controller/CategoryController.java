package com.flashticket.core.event.controller;

import com.flashticket.core.event.dto.CategoryResponse;
import com.flashticket.core.event.service.CategoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;


@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
@Slf4j
public class CategoryController {
    
    private final CategoryService categoryService;
    
    @GetMapping
    public ResponseEntity<List<CategoryResponse>> getCategories() {
        log.info("GET /api/categories - Fetching all active categories");
        
        List<CategoryResponse> categories = categoryService.getAllActiveCategories();
        
        log.info("GET /api/categories - Returned {} categories", categories.size());
        return ResponseEntity.ok(categories);
    }
}
