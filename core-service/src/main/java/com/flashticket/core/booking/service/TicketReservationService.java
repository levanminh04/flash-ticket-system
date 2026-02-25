package com.flashticket.core.booking.service;

import com.flashticket.core.common.exception.LockAcquisitionException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * TicketReservationService — Quản lý Redis Distributed Lock cho booking.
 *
 * TÁCH RA SERVICE RIÊNG vì:
 * 1. Single Responsibility — BookingService không cần biết về Redis cụ thể
 * 2. Dễ mock trong unit test (inject mock TicketReservationService)
 * 3. Có thể mở rộng sang per-seat lock (Phase 2D) mà không sửa BookingService
 *
 * Lock key convention:
 *   Zone ticket:   "lock:tickettype:{ticketTypeId}"
 *   Seat ticket:   "lock:seat:{eventId}:{seatId}"     (Phase 2D)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TicketReservationService {

    private final RedissonClient redissonClient;

    /**
     * Acquire distributed lock cho Zone ticket type.
     *
     * @param ticketTypeId ID của loại vé cần lock
     * @return RLock đang được held — caller PHẢI gọi unlock() trong finally block
     * @throws LockAcquisitionException nếu không lấy được lock trong waitTimeSeconds
     *
     * Tham số:
     * - waitTime  = 10s: Thời gian chờ tối đa để lấy lock.
     *   Flash sale: giảm xuống 3s để user nhận phản hồi nhanh.
     * - leaseTime = 30s: Lock tự động release sau 30s nếu server crash.
     *   Đặt dư so với thời gian xử lý booking (< 5s bình thường).
     */
    public RLock acquireZoneLock(UUID ticketTypeId) {
        String lockKey = "lock:tickettype:" + ticketTypeId;
        return tryAcquireLock(lockKey, 10, 30);
    }

    /**
     * Acquire distributed lock cho ghế cụ thể (Phase 2D — Seated mode).
     *
     * Mỗi ghế có lock riêng — cho phép nhiều user chọn ghế khác nhau đồng thời.
     * Chỉ conflict khi 2 user chọn cùng 1 ghế.
     */
    public RLock acquireSeatLock(UUID eventId, UUID seatId) {
        String lockKey = "lock:seat:" + eventId + ":" + seatId;
        return tryAcquireLock(lockKey, 10, 30);
    }

    /**
     * Mỗi khi một Thread chiếm được Lock, Redisson lưu lại một định danh duy nhất (thường là UUID của Redisson client + Thread ID).
     * Release lock an toàn — chỉ unlock nếu current thread đang hold lock.
     * Tránh IllegalMonitorStateException khi gọi unlock khi không hold. Thread A xóa nhầm Lock của Thread B.
     */
    public void releaseLock(RLock lock) {
        if (lock != null && lock.isHeldByCurrentThread()) { // isHeldByCurrentThread(), Redisson kiểm tra xem ID của Thread hiện tại có khớp với ID đang giữ khóa trên Redis hay không.
            lock.unlock();
            log.debug("Released lock: {}", lock.getName());
        }
    }

    private RLock tryAcquireLock(String lockKey, long waitTimeSeconds, long leaseTimeSeconds) {
        // Dòng này chưa hề tác động gì đến Redis. Nó chỉ tạo ra một đối tượng Proxy ở phía Java đại diện cho cái tên lockKey đó.
        RLock lock = redissonClient.getLock(lockKey); // KHÔNG lấy lock ngay. chỉ Tạo một object RLock, Đại diện cho Redis key = lockKey giống Lock lock = new ReentrantLock();
        boolean acquired;

        try {
            // Dòng này mới là chỗ thực sự lấy lock, call redis và thực hiện các bước
            /**
             * 1. Thử SET key trong Redis theo cơ chế distributed lock
             * 2. Nếu key đã tồn tại → chờ tối đa waitTimeSeconds
             * 3. Nếu lấy được: Gắn TTL = leaseTimeSeconds, Trả về true
             * 4. Nếu không lấy được sau thời gian chờ → trả về false
             * */
            acquired = lock.tryLock(waitTimeSeconds, leaseTimeSeconds, TimeUnit.SECONDS);

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            // Nếu hệ thống muốn tắt ứng dụng hoặc một luồng khác gọi thread.interrupt(),
            // Java cần một cơ chế để đánh thức Thread đó dậy và thông báo: "Này, đừng chờ nữa, nghỉ thôi!".
            throw new LockAcquisitionException("Bị ngắt khi chờ lock: " + lockKey);
        }

        if (!acquired) {
            log.warn("Failed to acquire lock after {}s: {}", waitTimeSeconds, lockKey);
            throw new LockAcquisitionException(
                "Hệ thống đang xử lý nhiều yêu cầu. Vui lòng thử lại sau vài giây.");
        }

        log.debug("Acquired lock: {}", lockKey);
        return lock;
    }
}
