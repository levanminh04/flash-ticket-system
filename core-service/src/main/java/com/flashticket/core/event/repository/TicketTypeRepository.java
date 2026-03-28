package com.flashticket.core.event.repository;

import com.flashticket.core.event.entity.TicketType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TicketTypeRepository extends JpaRepository<TicketType, UUID> {

    List<TicketType> findByEventIdAndIsDeletedFalse(UUID eventId);

    Optional<TicketType> findByIdAndIsDeletedFalse(UUID id);

    /**
     * Trả về số vé thực sự còn lại.
     * Dùng PESSIMISTIC_WRITE lock ngầm qua câu query — gọi sau khi có Redis lock.
     */
    @Query("SELECT t.quantityAvailable FROM TicketType t WHERE t.id = :id")
    Optional<Integer> findAvailableQuantityById(@Param("id") UUID id);

    /**
     * Atomic decrement sau khi tạo order (zone ticket).
     *
     * WHERE quantity_available >= :amount để đảm bảo không âm,
     * kể cả khi 2 threads thoát khỏi Redis lock theo thứ tự sai.
     *
     * @return số rows bị ảnh hưởng (1 = thành công, 0 = không đủ stock)
     */
    @Modifying // đánh dấu đây là query thay đổi dữ liệu, không phải query trả về entity.  trả về affected rows
    @Query("""
           UPDATE TicketType t
           SET t.quantityAvailable = t.quantityAvailable - :amount,
               t.quantityReserved  = t.quantityReserved  + :amount
           WHERE t.id = :id
             AND t.quantityAvailable >= :amount
           """) // trả về affected rows
    int decrementAvailableAndIncrementReserved(@Param("id") UUID id, @Param("amount") int amount);

    /**
     * Khi đơn hàng được xác nhận thanh toán: reserved → sold (chỉ trừ reserved,
     * available đã được trừ lúc booking).
     */
    @Modifying
    @Query("""
           UPDATE TicketType t
           SET t.quantityReserved = GREATEST(0, t.quantityReserved - :amount)
           WHERE t.id = :id
           """)
    void decrementReserved(@Param("id") UUID id, @Param("amount") int amount);

    /**
     * Restore stock khi order expire hoặc bị cancel.
     * available += amount, reserved -= amount (cả 2 nguyên tử trong 1 UPDATE).
     */
    @Modifying
    @Query("""
           UPDATE TicketType t
           SET t.quantityAvailable = t.quantityAvailable + :amount,
               t.quantityReserved  = GREATEST(0, t.quantityReserved - :amount)
           WHERE t.id = :id
           """)
    void restoreQuantity(@Param("id") UUID id, @Param("amount") int amount);

    /**
     * Cập nhật status thành SOLD_OUT khi quantityAvailable = 0.
     * Gọi sau mỗi lần booking (optional — để UI hiển thị đúng).
     */
    @Modifying
    @Query("""
           UPDATE TicketType t
           SET t.status = com.flashticket.core.event.entity.TicketType.TicketStatus.SOLD_OUT
           WHERE t.id = :id
             AND t.quantityAvailable = 0
             AND t.status = com.flashticket.core.event.entity.TicketType.TicketStatus.ACTIVE
           """)
    void markAsSoldOutIfEmpty(@Param("id") UUID id);

    // ============================================================
    // ORGANIZER — IDOR-safe queries
    // ============================================================

    /**
     * Tìm TicketType theo id VÀ eventId — IDOR protection.
     * Đảm bảo Organizer chỉ thao tác được TicketType thuộc event của mình.
     */
    Optional<TicketType> findByIdAndEventIdAndIsDeletedFalse(UUID id, UUID eventId);

    /**
     * Số vé đã bán = quantityTotal - quantityAvailable - quantityReserved
     * Dùng để kiểm tra trước khi giảm quantityTotal.
     */
    @Query("SELECT (t.quantityTotal - t.quantityAvailable - t.quantityReserved) FROM TicketType t WHERE t.id = :id")
    Integer countSoldTickets(@Param("id") UUID id);
}
