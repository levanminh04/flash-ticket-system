package com.flashticket.core.booking.service;

import com.flashticket.core.booking.event.SeatStatusChangedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RMapCache;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class SeatStatusCacheListener {

    private final RedissonClient redissonClient;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleSeatStatusChanged(SeatStatusChangedEvent event) {
        if (!event.replaceExisting() && (event.seatStatuses() == null || event.seatStatuses().isEmpty())) {
            return;
        }

        try {
            RMapCache<UUID, String> cache = redissonClient.getMapCache("seat_status:" + event.eventId());
            if (event.replaceExisting()) {
                cache.clear();
            }
            if (event.seatStatuses() != null && !event.seatStatuses().isEmpty()) {
                cache.putAll(event.seatStatuses());
            }
            cache.expire(Duration.ofHours(48));
        } catch (RuntimeException ex) {
            log.warn("Failed to update seat status cache after commit for event {}: {}",
                event.eventId(), ex.getMessage());
        }
    }
}
