package com.flashticket.core.promotion.service;

import com.flashticket.core.common.exception.InvalidRequestException;
import com.flashticket.core.promotion.entity.Promotion;
import com.flashticket.core.promotion.entity.PromotionUsage;
import com.flashticket.core.promotion.repository.PromotionRepository;
import com.flashticket.core.promotion.repository.PromotionUsageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.UUID;

/**
 * PromotionService — Quản lý toàn bộ vòng đời của promotion.
 *
 * ┌──────────────────────────────────────────────────────────────────┐
 * │                     PROMOTION LIFECYCLE                          │
 * ├──────────────────────────────────────────────────────────────────┤
 * │ Bước 1 — reservePromotion()  [BookingService.createBooking()]    │
 * │   - Validate 5 rules                                             │
 * │   - Atomic increment current_uses (giữ slot 15 phút)            │
 * │   - Trả DiscountResult để tính giá                               │
 * │                                                                  │
 * │ Bước 2A — confirmPromotion() [PaymentService.handleIPN()]        │
 * │   - Lưu PromotionUsage record với orderId thật                   │
 * │   (chỉ khi payment SUCCESS)                                      │
 * │                                                                  │
 * │ Bước 2B — releasePromotion() [cancelOrder / expireOne()]         │
 * │   - Atomic decrement current_uses (trả slot về)                  │
 * │   (khi order cancel hoặc expire trong 15 phút)                   │
 * └──────────────────────────────────────────────────────────────────┘
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PromotionService {

    private final PromotionRepository promotionRepository;
    private final PromotionUsageRepository promotionUsageRepository;

    // ══ BƯỚC 1: RESERVE ══════════════════════════════════════════════════════

    /**
     * Validate và reserve promotion slot khi user tạo order.
     *
     * Atomic increment current_uses ngay tại đây để chống race condition
     * (nhiều user dùng voucher cuối cùng cùng lúc).
     *
     * Nếu order expire/cancel → gọi releasePromotion() để trả slot về.
     * Nếu payment success    → gọi confirmPromotion() để lưu usage record.
     *
     * @return DiscountResult chứa promotionId và discountAmount
     * @throws InvalidRequestException nếu voucher không hợp lệ
     */
    @Transactional
    public DiscountResult reservePromotion(String code, String userId, UUID eventId, BigDecimal subtotal) {
        // ── Rule 1: Voucher có tồn tại không?
        Promotion promo = promotionRepository.findByCodeAndIsDeletedFalse(code.trim().toUpperCase())
            .orElseThrow(() -> new InvalidRequestException("Mã voucher '" + code + "' không tồn tại"));

        // ── Rule 2: Voucher còn hạn sử dụng không?
        Instant now = Instant.now();
        if (now.isBefore(promo.getStartDatetime())) {
            throw new InvalidRequestException("Mã voucher '" + code + "' chưa được kích hoạt");
        }
        if (now.isAfter(promo.getEndDatetime())) {
            throw new InvalidRequestException("Mã voucher '" + code + "' đã hết hạn sử dụng");
        }
        if (promo.getStatus() != Promotion.PromotionStatus.ACTIVE) {
            throw new InvalidRequestException("Mã voucher '" + code + "' hiện không khả dụng");
        }

        // ── Rule 3: User đã dùng voucher này chưa?
        // Đếm PromotionUsage records (chỉ có sau payment SUCCESS) — chính xác hơn đếm theo order PENDING
        if (promo.getMaxUsesPerUser() != null && promo.getMaxUsesPerUser() > 0) {
            long userUsageCount = promotionUsageRepository.countByUserIdAndPromotionId(userId, promo.getId());
            if (userUsageCount >= promo.getMaxUsesPerUser()) {
                throw new InvalidRequestException(
                    "Bạn đã sử dụng mã voucher '" + code + "' tối đa số lần cho phép");
            }
        }

        // ── Rule 4: Đơn hàng đủ điều kiện không?
        if (promo.getMinOrderValue() != null && subtotal.compareTo(promo.getMinOrderValue()) < 0) {
            throw new InvalidRequestException(String.format(
                "Đơn hàng tối thiểu %.0f VND để sử dụng mã này", promo.getMinOrderValue()));
        }

        // ── Rule 5: Scope event (SPECIFIC_EVENTS)
        // TODO Phase 2B: Thêm applicable_event_ids field và filter khi implement scope.
        // Hiện tại ALL events đều áp dụng được.

        // ── Tính discount amount
        BigDecimal discountAmount = calculateDiscount(promo, subtotal);

        // ── Atomic increment — chống race condition - optimistic locking
        if (promo.getMaxTotalUses() != null) {
            int updated = promotionRepository.atomicIncrementUsage(promo.getId());
            if (updated == 0) {
                throw new InvalidRequestException("Mã voucher '" + code + "' đã hết lượt sử dụng");
            }
        } else {
            // Unlimited — vẫn increment để tracking thống kê
            promotionRepository.atomicIncrementUsage(promo.getId());
        }

        log.info("Promotion '{}' reserved for user {}, discount: {} VND", code, userId, discountAmount);
        return new DiscountResult(promo.getId(), discountAmount);
    }

    // ══ BƯỚC 2A: CONFIRM (sau payment SUCCESS) ════════════════════════════════

    /**
     * Lưu PromotionUsage record sau khi payment SUCCESS.
     * Gọi bởi PaymentService.handleIPN() — KHÔNG gọi trong BookingService.
     */
    @Transactional(propagation = Propagation.REQUIRED)
    public void confirmPromotion(UUID promotionId, String userId, UUID orderId, BigDecimal discountAmount) {
        PromotionUsage usage = PromotionUsage.builder()
            .promotionId(promotionId)
            .userId(userId)
            .orderId(orderId)
            .discountAmount(discountAmount)
            .build();
        promotionUsageRepository.save(usage);
        log.info("Promotion {} confirmed for order {}", promotionId, orderId);
    }

    // ══ BƯỚC 2B: RELEASE (cancel / expire) ═══════════════════════════════════

    /**
     * Trả slot promotion về khi order cancel hoặc expire.
     * Gọi bởi BookingService.cancelOrder() và OrderExpirationService.expireOne().
     *
     * Chỉ cần promotionId — lấy từ Order.promotionId (null nếu không dùng voucher).
     */
    @Transactional(propagation = Propagation.REQUIRED)
    public void releasePromotion(UUID promotionId) {
        if (promotionId == null) return; // order không dùng voucher
        promotionRepository.decrementUsage(promotionId);
        log.debug("Promotion {} slot released", promotionId);
    }

    // ══ PRIVATE ═══════════════════════════════════════════════════════════════

    private BigDecimal calculateDiscount(Promotion promo, BigDecimal subtotal) {
        BigDecimal discount = switch (promo.getDiscountType()) {
            case PERCENTAGE -> subtotal
                .multiply(promo.getDiscountValue())
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

            case FIXED_AMOUNT -> promo.getDiscountValue().min(subtotal); // không vượt quá subtotal
        };

        // Cap bởi maxDiscountAmount nếu có (thường dùng cho PERCENTAGE type)
        if (promo.getMaxDiscountAmount() != null) {
            discount = discount.min(promo.getMaxDiscountAmount());
        }

        return discount;
    }

    /** Value object — kết quả sau khi reserve promotion */
    public record DiscountResult(
            UUID promotionId,
            BigDecimal amount
    ) {
        public static final DiscountResult ZERO = new DiscountResult(null, BigDecimal.ZERO);
    }
}
