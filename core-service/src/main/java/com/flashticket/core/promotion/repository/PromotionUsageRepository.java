package com.flashticket.core.promotion.repository;

import com.flashticket.core.promotion.entity.PromotionUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface PromotionUsageRepository extends JpaRepository<PromotionUsage, UUID> {

    /**
     * Đếm số lần user đã dùng 1 voucher cụ thể.
     * Dùng để enforce max_uses_per_user.
     */
    long countByUserIdAndPromotionId(String userId, UUID promotionId);
}
