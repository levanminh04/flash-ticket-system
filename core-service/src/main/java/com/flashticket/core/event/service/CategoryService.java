package com.flashticket.core.event.service;

import com.flashticket.core.event.dto.CategoryResponse;
import com.flashticket.core.event.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;


@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true) // Bình thường, Hibernate sẽ phải theo dõi tất cả các đối tượng lấy ra để xem có thay đổi gì không (để tự động lưu vào DB). Với readOnly, nó bỏ qua bước này, giúp tiết kiệm CPU và bộ nhớ.
public class CategoryService {
    
    private final CategoryRepository categoryRepository;
    
    /**
     * Lấy tất cả categories đang active
     */
    public List<CategoryResponse> getAllActiveCategories() {
        log.debug("Fetching all active categories");
        
        return categoryRepository.findByIsDeletedFalseAndIsActiveTrueOrderByDisplayOrderAsc()
            .stream()
            .map(CategoryResponse::from)
            .toList();
    }
}
