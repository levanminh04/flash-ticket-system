package com.flashticket.core.promotion.repository;

import com.flashticket.core.promotion.entity.Promotion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface PromotionRepository extends JpaRepository<Promotion, UUID> {

    Optional<Promotion> findByCodeAndIsDeletedFalse(String code);

    /**
     * Atomic increment — chống race condition khi nhiều user cùng dùng voucher cuối.
     *
     * Thay vì:
     *   promotion.setCurrentUses(promotion.getCurrentUses() + 1) ← RACE CONDITION
     *
     * Dùng:
     *   UPDATE ... SET current_uses = current_uses + 1 WHERE current_uses < max_total_uses
     *
     * @return số rows bị ảnh hưởng — 0 nếu đã hết lượt, 1 nếu thành công
     */
    @Modifying
    @Query("""
           UPDATE Promotion p
           SET p.currentUses = p.currentUses + 1
           WHERE p.id = :promotionId
             AND (p.maxTotalUses IS NULL OR p.currentUses < p.maxTotalUses)
           """)
    int atomicIncrementUsage(@Param("promotionId") UUID promotionId);

    /**
     * Giảm current_uses khi order bị cancel hoặc expire.
     * GREATEST(0, ...) đảm bảo không bao giờ âm dù có edge case.
     */
    @Modifying
    @Query("""
           UPDATE Promotion p
           SET p.currentUses = GREATEST(0, p.currentUses - 1)
           WHERE p.id = :promotionId
           """)
    void decrementUsage(@Param("promotionId") UUID promotionId);
}
