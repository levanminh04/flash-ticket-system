package com.flashticket.core.config.messaging;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import static com.flashticket.core.shared.messaging.RabbitMQConstants.*;

/**
 * RabbitMQ Topology Configuration.
 *
 * Exchanges:
 *   ex.payment  (Direct) ─── routing key "payment.success" ──► q.ticket.issue
 *   ex.ticket   (Direct) ─── routing key "ticket.issued"   ──► q.email.send
 *
 * Dead-Letter:
 *   q.ticket.issue ──[on Nack x3]──► q.ticket.issue.dlq
 *   q.email.send   ──[on Nack x3]──► q.email.send.dlq
 *
 * Tại sao 2 Queue nối tiếp thay vì Fanout?
 *   Email Worker cần data Ticket đã được INSERT vào DB.
 *   Nếu Fanout song song, Email Worker có thể chạy trước khi Ticket được lưu → Race Condition.
 *   Choreography (nối tiếp) đảm bảo order nghiêm ngặt.
 */
@Configuration
public class RabbitMQConfig {

    // ══ Exchanges ═════════════════════════════════════════════════════════════
    // Bean TopicExchange chỉ là TỜ GIẤY THIẾT KẾ
    @Bean
    DirectExchange paymentExchange() {
        return new DirectExchange(EXCHANGE_PAYMENT, true, false);
    }

    @Bean
    DirectExchange ticketExchange() {
        return new DirectExchange(EXCHANGE_TICKET, true, false);
    }

    /** Dead-Letter Exchange — nhận Nack message từ cả 2 Queue chính */
    @Bean
    DirectExchange deadLetterExchange() {
        return new DirectExchange(EXCHANGE_DEAD_LETTER, true, false);
    }


    // Bean Queue ticketIssueQueue chỉ là TỜ GIẤY THIẾT KẾ, Nó chỉ chứa thông tin: "Tôi muốn một hàng đợi tên là "QUEUE_TICKET_ISSUE", bền vững".
    /**
     * Arguments là gì trong RabbitMQ?
     * Hiểu đơn giản là metadata dạng key-value gắn vào queue/exchange khi tạo, dùng để cấu hình behavior:
     *  Queue không có arguments:
     *     └─ hoạt động mặc định, message không bao giờ hết hạn,
     *        không giới hạn số lượng, không có DLQ
     *
     *  Queue có arguments:
     *     └─ x-message-ttl=60000     → message tự xóa sau 60 giây, áp dụng cho từng message tính từ lúc message vào queue, Nếu có DLX thì hết TTL sẽ được đẩy vào DLX không thì sẽ bị xóa vĩnh viễn luôn
     *     └─ x-max-length=1000       → queue chứa tối đa 1000 message
     *     └─ x-dead-letter-exchange  → message chết đi đâu
     * */
    @Bean
    Queue ticketIssueQueue() {
        return QueueBuilder.durable(QUEUE_TICKET_ISSUE)
            // Khi message bị Nack → chuyển sang DLX với routing key = tên queue gốc
            .withArgument("x-dead-letter-exchange", EXCHANGE_DEAD_LETTER) // Không có DLQ thì message bị NACK sẽ biến mất hoàn toàn
            .withArgument("x-dead-letter-routing-key", QUEUE_TICKET_DLQ)
            .build();
    }


    @Bean
    Queue emailSendQueue() {
        return QueueBuilder.durable(QUEUE_EMAIL_SEND)
            .withArgument("x-dead-letter-exchange", EXCHANGE_DEAD_LETTER)
            .withArgument("x-dead-letter-routing-key", QUEUE_EMAIL_DLQ)
            .build();
    }

    /** DLQ — Lưu message cấp vé thất bại. Admin xử lý thủ công hoặc trigger retry batch. */
    @Bean
    Queue ticketDlq() {
        return QueueBuilder.durable(QUEUE_TICKET_DLQ).build();
    }

    /** DLQ — Lưu message gửi email thất bại. Không ảnh hưởng đến luồng Ticket. */
    @Bean
    Queue emailDlq() {
        return QueueBuilder.durable(QUEUE_EMAIL_DLQ).build();
    }




    // Bean Binding chỉ là TỜ GIẤY THIẾT KẾ
    // Ở đây gọi hàm queue() và topicExchange(). Trong Java thường, gọi hàm là tạo mới object.
    // Nhưng vì có @Configuration, Spring sử dụng kỹ thuật CGLIB proxy.
    // Khi gọi queue(), Spring thông minh chặn lại kiểm tra: "Cái Bean Queue này tạo chưa? Nếu tạo rồi thì trả về cái đang có trong bộ nhớ, không tạo mới."
    // -> Đảm bảo tính nhất quán (Singleton).
    @Bean
    Binding bindingTicketIssue() {
        return BindingBuilder.bind(ticketIssueQueue())
            .to(paymentExchange())
            .with(RK_PAYMENT_SUCCESS);
    }

    @Bean
    Binding bindingEmailSend() {
        return BindingBuilder.bind(emailSendQueue())
            .to(ticketExchange())
            .with(RK_TICKET_ISSUED);
    }

    @Bean
    Binding bindingTicketDlq() {
        return BindingBuilder.bind(ticketDlq())
            .to(deadLetterExchange())
            .with(QUEUE_TICKET_DLQ);
    }

    @Bean
    Binding bindingEmailDlq() {
        return BindingBuilder.bind(emailDlq())
            .to(deadLetterExchange())
            .with(QUEUE_EMAIL_DLQ);
    }

    // ══ Message Converter ═════════════════════════════════════════════════════

    /**
     * JSON (de)serializer cho tất cả message.
     * Cho phép Producer gửi Java object → JSON bytes và Consumer nhận JSON bytes → Java object.
     * RabbitMQ chỉ hiểu byte (mảng byte). Java dùng Object (ví dụ OrderDTO).
     */
    @Bean
    Jackson2JsonMessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    /**
     * RabbitTemplate — inject MessageConverter để tự động serialize object → JSON.
     *
     *     Khi RabbitAdmin được khởi tạo, (phương thức afterPropertiesSet hoặc initialize). Nó sẽ làm hành động sau:
     *     "Này Spring Context! Hãy liệt kê cho tôi tất cả các Bean có kiểu là Queue, Exchange, và Binding đang có trong bộ nhớ!"
     *     Spring Context đưa cho RabbitAdmin danh sách các bean đã tạo (queue(), topicExchange(),...).
     *     Lúc này, RabbitAdmin dùng cái ConnectionFactory (mà nó nắm giữ) để gọi lên Server RabbitMQ thật
     *     Tham số ConnectionFactory: Khi Spring khởi tạo hàm này, nó tự động tìm  ConnectionFactory (đã được Spring Boot tự cấu hình dựa trên host/port/username/password trong file properties) và ném vào đây.
     *     Đây là chìa khóa để mở cửa vào RabbitMQ Server.
     */
    @Bean
    RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter());
        return template;
    } // RabbitTemplate không phải là một kết nối. Nó là một Facade Pattern (Mặt tiền) che giấu sự phức tạp của việc quản lý kết nối, kênh (channel) và gửi tin.

    /**
     * khuôn mẫu để Spring tạo ra các container chạy @RabbitListener
     * ListenerContainerFactory với:
     * - AcknowledgeMode.MANUAL  — Consumer tự gọi ACK/NACK sau khi xử lý xong
     * - prefetchCount = 1       — Chỉ lấy 1 message/lần, đảm bảo fair dispatch khi scale nhiều instance
     * - concurrency = 1-3       — Pool thread cho Consumer (điều chỉnh theo tải thực tế)
     */
    @Bean
    SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
        ConnectionFactory connectionFactory
    ) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(messageConverter());
        factory.setAcknowledgeMode(AcknowledgeMode.MANUAL); // Consumer tự quyết định ACK/NACK sau khi xử lý xong.
        factory.setPrefetchCount(1); // Mỗi consumer chỉ giữ 1 message trong tay tại một thời điểm.
        factory.setConcurrentConsumers(1);
        factory.setMaxConcurrentConsumers(3);
        return factory;
    }
//    setConcurrentConsumers(1) + setMaxConcurrentConsumers(3)
//    Bình thường:  1 thread xử lý message
//    Tải tăng:     Spring tự scale lên 2, 3 threads
//    Tải giảm:     Spring tự scale down về 1 thread

//    rabbitListenerContainerFactory (khuôn mẫu)
//    │
//    ├─► Container 1 chạy @RabbitListener(queues = QUEUE_TICKET_ISSUE)
//    │       └─ thread pool: 1-3 threads
//    │       └─ prefetch: 1
//    │       └─ ack: MANUAL
//    │
//    └─► Container 2 chạy @RabbitListener(queues = QUEUE_EMAIL_SEND)
//            └─ thread pool: 1-3 threads
//            └─ prefetch: 1
//            └─ ack: MANUAL
}
