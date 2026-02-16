package com.flashticket.core.event.repository;

import com.flashticket.core.event.entity.Category;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;


@Repository
public interface CategoryRepository extends JpaRepository<Category, UUID> {
    
    /**
     * Lấy tất cả categories đang active (không bị xóa, đang hiển thị)
     * Sắp xếp theo display_order tăng dần
     */
    @EntityGraph(attributePaths = {"parent"}) // Ép Hibernate JOIN với bảng Parent ngay từ đầu, tránh N + 1 QUERY, parent là tên thuộc tính, không phải tên cột trong table
    List<Category> findByIsDeletedFalseAndIsActiveTrueOrderByDisplayOrderAsc();
}
