package com.flashticket.core.booking.repository;

import com.flashticket.core.booking.entity.Ticket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
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
     * Đếm số vé đã cấp cho 1 order — dùng để verify issuance hoàn chỉnh
     */
    long countByOrderIdAndIsDeletedFalse(UUID orderId);
}
