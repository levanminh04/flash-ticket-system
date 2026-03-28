package com.flashticket.core.event.repository;

import com.flashticket.core.event.entity.Event;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

/**
 * Event Repository
 *
 * Extends JpaSpecificationExecutor để support dynamic queries với Specification.
 *
 * ============================================================
 * GHI CHÚ QUAN TRỌNG: MultipleBagFetchException
 * ============================================================
 * VẤN ĐỀ CŨ:
 *   @EntityGraph(attributePaths = {"venue", "images", "ticketTypes", "categories"})
 *   → Hibernate cố JOIN 3 List (images, ticketTypes, categories) cùng 1 lúc
 *   → Tạo ra Cartesian Product:
 *       1 event × 4 images × 3 ticketTypes × 5 categories = 60 rows cho 1 event!
 *   → Hibernate ném MultipleBagFetchException vì không thể map đúng
 *     các dòng trùng lặp này ngược lại vào List mà không làm sai dữ liệu.
 *
 * GIẢI PHÁP:
 *   @EntityGraph chỉ fetch "venue" (ManyToOne — không phải collection, an toàn).
 *   Các collections (images, ticketTypes, categories) để LAZY.
 *   Trên Entity, dùng @BatchSize(size = 20) cho từng collection:
 *     → Khi mapper access event.getImages(), Hibernate tự fire 1 query riêng:
 *         SELECT * FROM event_images WHERE event_id IN ('id1', 'id2', ...)
 *     → Tương tự cho ticketTypes và categories.
 *   Kết quả: 4 queries nhỏ, không Cartesian, không exception.
 *
 * XEM THÊM: Event.java — @BatchSize được đặt trên từng collection field.
 * ============================================================
 */
@Repository
public interface EventRepository extends JpaRepository<Event, UUID>,
                                         JpaSpecificationExecutor<Event> {

    /**
     * Override findAll để eager load venue (prevent N+1 queries).
     * Khi load 12 events → 1 query JOIN venue thay vì 13 queries.
     *
     * Chỉ fetch "venue" (ManyToOne) — an toàn, không Cartesian product.
     * Các collections (images, ticketTypes, categories) KHÔNG được fetch ở đây
     * vì listing page dùng denormalized fields (minPrice, bannerUrl) thay thế.
     */
    @Override
    @EntityGraph(attributePaths = {"venue"})
    Page<Event> findAll(Specification<Event> spec, Pageable pageable);

    // ============================================================
    // PHIÊN BẢN CŨ — ĐÃ GÂY MultipleBagFetchException
    // Giữ lại để tham khảo, KHÔNG SỬ DỤNG.
    //
    // @EntityGraph(attributePaths = {"venue", "images", "ticketTypes", "categories"})
    // Optional<Event> findByIdAndIsDeletedFalse(UUID id);
    //
    // @EntityGraph(attributePaths = {"venue", "images", "ticketTypes", "categories"})
    // Optional<Event> findBySlugAndIsDeletedFalse(String slug);
    // ============================================================

    /**
     * Tìm event theo ID cho Event Detail API.
     *
     * STRATEGY: @EntityGraph chỉ fetch "venue" (ManyToOne — 1 JOIN, an toàn).
     * Collections (images, ticketTypes, categories) được load LAZY bởi @BatchSize
     * trên Event entity — Hibernate tự fire query riêng khi mapper access chúng:
     *   Query 1: SELECT event JOIN venue   ← @EntityGraph
     *   Query 2: SELECT categories ...     ← @BatchSize khi mapper gọi getCategories()
     *   Query 3: SELECT ticket_types ...   ← @BatchSize khi mapper gọi getTicketTypes()
     *   Query 4: SELECT event_images ...   ← @BatchSize khi mapper gọi getImages()
     * Tổng: 4 queries nhỏ thay vì 1 query Cartesian khổng lồ.
     */
    @EntityGraph(attributePaths = {"venue"})
    Optional<Event> findByIdAndIsDeletedFalse(UUID id);

    /**
     * Tìm event theo slug cho Event Detail API (SEO-friendly URL).
     *
     * Cùng strategy với findByIdAndIsDeletedFalse:
     * @EntityGraph chỉ fetch "venue", collections load LAZY qua @BatchSize.
     */
    @EntityGraph(attributePaths = {"venue"})
    Optional<Event> findBySlugAndIsDeletedFalse(String slug);

    /**
     * Tăng số vé đã bán nguyên tử để tránh Race Condition (Lost Update).
     */
    @Modifying
    @Query("UPDATE Event e SET e.ticketsSold = e.ticketsSold + :amount WHERE e.id = :id")
    void incrementTicketsSold(@Param("id") UUID id, @Param("amount") int amount);

    // ============================================================
    // ORGANIZER — IDOR-safe queries
    // ============================================================

    /**
     * Tìm event cho Organizer — đảm bảo IDOR protection.
     * Trả về 404 nếu event không thuộc organizerId này.
     */
    @EntityGraph(attributePaths = {"venue"})
    Optional<Event> findByIdAndOrganizerIdAndIsDeletedFalse(UUID id, String organizerId);

    /**
     * List tất cả events của một Organizer (paginated).
     */
    @EntityGraph(attributePaths = {"venue"})
    Page<Event> findByOrganizerIdAndIsDeletedFalse(String organizerId, Pageable pageable);

    /**
     * Kiểm tra slug đã tồn tại chưa (để auto-gen slug unique).
     */
    boolean existsBySlugAndIsDeletedFalse(String slug);

    /**
     * Atomic update tổng sức chứa khi thêm/xóa TicketType.
     * Dùng GREATEST(0, ...) để tránh totalCapacity âm.
     */
    @Modifying
    @Query("UPDATE Event e SET e.totalCapacity = GREATEST(0, e.totalCapacity + :delta) WHERE e.id = :id")
    void adjustTotalCapacity(@Param("id") UUID id, @Param("delta") int delta);

    /**
     * Đếm TicketType ACTIVE của event (dùng để validate trước khi publish).
     */
    @Query("SELECT COUNT(t) FROM TicketType t WHERE t.event.id = :eventId AND t.isDeleted = false AND t.status = 'ACTIVE'")
    long countActiveTicketTypes(@Param("eventId") UUID eventId);
}
