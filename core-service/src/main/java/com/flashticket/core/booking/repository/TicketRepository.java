package com.flashticket.core.booking.repository;

import com.flashticket.core.booking.entity.Ticket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, UUID> {

    /**
     * Danh sách vé của user — cho API GET /api/tickets/my-tickets
     */
    Page<Ticket> findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(String userId, Pageable pageable);

    /**
     * Tìm vé theo ID và đảm bảo thuộc user — IDOR protection
     */
    Optional<Ticket> findByIdAndUserIdAndIsDeletedFalse(UUID id, String userId);

    /**
     * Tất cả vé của 1 order — dùng khi cancel/refund
     */
    List<Ticket> findByOrderIdAndIsDeletedFalse(UUID orderId);

    /**
     * Tìm vé qua ticket code — dùng khi check-in (scan QR)
     */
    Optional<Ticket> findByTicketCodeAndIsDeletedFalse(String ticketCode);

    /**
     * Tìm vé và LOCK bản ghi để check-in (Pessimistic Lock) — Tránh Race Condition khi 2 cổng cùng scan 1 vé.
     * @Lock(LockModeType.PESSIMISTIC_WRITE) yêu cầu Cơ sở dữ liệu (Database) tạo ra một Khóa ghi bi quan (Pessimistic Write Lock) lên dòng dữ liệu (row) sắp được lấy lên.
     *
     * Dưới góc độ SQL: Khi code này chạy, Hibernate sẽ tự động gắn thêm cụm từ FOR UPDATE vào cuối câu lệnh SQL
     * (ví dụ: SELECT * FROM ticket WHERE ticket_code = ? AND is_deleted = false FOR UPDATE;).
     * Để lệnh @Lock này hoạt động, bắt buộc nó phải được gọi bên trong một @Transaction.
     * Nếu không có Transaction, khóa sẽ được nhả ra ngay lập tức sau khi câu lệnh SELECT chạy xong, làm mất hoàn toàn tác dụng.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT t FROM Ticket t WHERE t.ticketCode = :ticketCode AND t.isDeleted = false")
    Optional<Ticket> findByTicketCodeForUpdate(@Param("ticketCode") String ticketCode);

    /**
     * Đếm số vé đã cấp cho 1 order — dùng để verify issuance hoàn chỉnh
     */
    long countByOrderIdAndIsDeletedFalse(UUID orderId);
}
