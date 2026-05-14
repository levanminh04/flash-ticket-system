package com.flashticket.discovery.ingest.listener;

import com.flashticket.discovery.ingest.service.EmbeddingIngestionService;
import com.flashticket.discovery.shared.messaging.DiscoveryMQConstants;
import com.rabbitmq.client.Channel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

/**
 * Consumer RabbitMQ — nhận event data từ core-service.
 * Manual ACK pattern (nhất quán với core-service).
 *
 * Flow:
 *   core-service publish EventSyncSpringEvent
 *   → RabbitMQ ex.discovery / event.sync
 *   → q.discovery.event.sync
 *   → EventDataListener
 *   → EmbeddingIngestionService.upsertEvent() or deleteEvent()
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class EventDataListener {

    private final EmbeddingIngestionService ingestionService;

    @RabbitListener(queues = DiscoveryMQConstants.QUEUE_EVENT_SYNC)
    public void handleEventSync(
            EmbeddingIngestionService.EventSyncMessage message,
            Channel channel,
            @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) {
        try {
            log.info("[EventDataListener] Received event sync: eventId={}, status={}",
                    message.eventId(), message.status());

            if ("DELETED".equals(message.status())) {
                ingestionService.deleteEvent(message.eventId().toString());
            } else {
                ingestionService.upsertEvent(message);
            }
            channel.basicAck(deliveryTag, false);
        } catch (Exception e) {
            log.error("[EventDataListener] Failed to process: {}", message.eventId(), e);
            try {
                channel.basicNack(deliveryTag, false, false); // → DLQ
            } catch (Exception ignored) {}
        }
    }
}
