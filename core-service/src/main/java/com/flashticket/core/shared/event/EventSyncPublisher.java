package com.flashticket.core.shared.event;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import static com.flashticket.core.shared.messaging.RabbitMQConstants.*;

/**
 * Publish event data → discovery-service qua RabbitMQ.
 *
 * Data đã được serialize trong transaction (bởi EventSyncHelper)
 * → publisher chỉ việc gửi Map thuần, không access lazy proxy.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EventSyncPublisher {

    private final RabbitTemplate rabbitTemplate;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleEventSync(EventSyncSpringEvent springEvent) {
        try {
            rabbitTemplate.convertAndSend(EXCHANGE_DISCOVERY, RK_EVENT_SYNC, springEvent.data());
            log.info("[EventSync] Published to discovery: action={}, data.eventId={}",
                    springEvent.action(), springEvent.data().get("eventId"));
        } catch (Exception e) {
            log.error("[EventSync] Failed to publish: action={}", springEvent.action(), e);
        }
    }
}
