package com.flashticket.user.config.messaging;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import static com.flashticket.user.shared.messaging.RabbitMQConstants.*;

/**
 * RabbitMQ Topology cho User Service.
 *
 * Topology:
 *   Exchange: keycloak.events (Topic — vì Keycloak SPI dùng routing key động)
 *   Queue:    q.keycloak.user.sync
 *   Binding:  keycloak.events → q.keycloak.user.sync (routing key: user.#)
 *   DLQ:      q.keycloak.user.sync.dlq
 *
 * Note: Dùng TopicExchange (không phải Direct như core-service) vì:
 *       Keycloak SPI có thể gửi nhiều loại event (user.register, user.update, user.delete)
 *       với cùng pattern. Topic cho phép binding user.# nhận tất cả.
 *
 * Cấu hình Consumer: Mirror core-service — MANUAL ack + prefetch=1 để đảm bảo exactly-once.
 */
@Configuration
public class RabbitMQConfig {

    // ── Exchange ──────────────────────────────────────────────────────────────

    @Bean
    TopicExchange keycloakEventsExchange() {
        return new TopicExchange(EXCHANGE_KEYCLOAK_EVENTS, true, false);
    }

    @Bean
    DirectExchange deadLetterExchange() {
        return new DirectExchange("keycloak.events.dlx", true, false);
    }

    // ── Queues ────────────────────────────────────────────────────────────────

    @Bean
    Queue userSyncQueue() {
        return QueueBuilder.durable(QUEUE_USER_SYNC)
                .withArgument("x-dead-letter-exchange", "keycloak.events.dlx")
                .withArgument("x-dead-letter-routing-key", QUEUE_USER_SYNC_DLQ)
                .build();
    }

    @Bean
    Queue userSyncDlq() {
        return QueueBuilder.durable(QUEUE_USER_SYNC_DLQ).build();
    }

    // ── Bindings ──────────────────────────────────────────────────────────────

    @Bean
    Binding bindingUserSync() {
        // user.# → nhận user.register, user.update, user.delete
        return BindingBuilder.bind(userSyncQueue())
                .to(keycloakEventsExchange())
                .with("#");
    }

    @Bean
    Binding bindingUserSyncDlq() {
        return BindingBuilder.bind(userSyncDlq())
                .to(deadLetterExchange())
                .with(QUEUE_USER_SYNC_DLQ);
    }

    // ── Message Converter ─────────────────────────────────────────────────────

    @Bean
    Jackson2JsonMessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter());
        return template;
    }

    /**
     * Consumer factory — MANUAL ack, prefetch=1
     * Mirror từ core-service để đảm bảo đồng nhất behavior.
     */
    @Bean
    SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            ConnectionFactory connectionFactory) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(messageConverter());
        factory.setAcknowledgeMode(AcknowledgeMode.MANUAL);
        factory.setPrefetchCount(1);
        factory.setConcurrentConsumers(1);
        factory.setMaxConcurrentConsumers(3);
        return factory;
    }
}
