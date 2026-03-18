package com.flashticket.core.notification.messaging;

import com.flashticket.core.shared.messaging.RabbitMQConstants;
import com.flashticket.core.shared.event.TicketIssuedEvent;
import com.flashticket.core.notification.service.EmailService;
import com.rabbitmq.client.Channel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Consumer: Lắng nghe Queue {@code q.email.send} và gửi email xác nhận vé.
 *
 * <p>Chỉ được trigger SAU khi {TicketMessageListener} cấp vé thành công.
 * Đảm bảo khi email được gửi, Ticket Data đã tồn tại đầy đủ trong DB.
 *
 * <p>Lỗi gửi mail (SMTP timeout, quota...) sẽ vào DLQ riêng biệt, KHÔNG ảnh hưởng đến Ticket.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EmailMessageListener {

    private final EmailService emailService;

    @RabbitListener(queues = RabbitMQConstants.QUEUE_EMAIL_SEND)
    public void handleTicketIssued(
        TicketIssuedEvent event,
        Channel channel,
        @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag
    ) throws IOException {

        log.info("[EmailWorker] Received TicketIssuedEvent — orderId={}", event.orderId());

        try {
            emailService.sendTicketConfirmationEmail(event);

            log.info("[EmailWorker] Email sent successfully — orderId={}", event.orderId());

            // ACK — message xử lý thành công mới gửi ACK
            // mặc định không cấu hình (AcknowledgeMode.AUTO) thì nhận message là ack. như vậy sẽ nguy hiểm vì có thể issue ticket bị lỗi giữa chừng thì sẽ không còn event trong queue để xử lý lại nữa
            channel.basicAck(deliveryTag, false);

        } catch (Exception e) {
            log.error("[EmailWorker] Failed to send email — orderId={}: {}",
                event.orderId(), e.getMessage(), e);

            // NACK + requeue=false → vào DLQ email riêng biệt
            // Ticket đã được cấp thành công, không cần rollback
            channel.basicNack(deliveryTag, false, false);
        }
    }
}
