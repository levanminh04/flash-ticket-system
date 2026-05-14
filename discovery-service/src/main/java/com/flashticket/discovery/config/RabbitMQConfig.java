package com.flashticket.discovery.config;

import org.springframework.amqp.core.*;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import static com.flashticket.discovery.shared.messaging.DiscoveryMQConstants.*;


@Configuration
public class RabbitMQConfig {

    // ══ Exchange ═══════════════════════════════════════════════════════════════
    @Bean
    DirectExchange discoveryExchange() {
        return new DirectExchange(EXCHANGE_DISCOVERY, true, false);
    }

    @Bean
    DirectExchange deadLetterExchange() {
        return new DirectExchange(EXCHANGE_DEAD_LETTER, true, false);
    }

    // ══ Queues ═════════════════════════════════════════════════════════════════
    @Bean
    Queue eventSyncQueue() {
        return QueueBuilder.durable(QUEUE_EVENT_SYNC)
                .withArgument("x-dead-letter-exchange", EXCHANGE_DEAD_LETTER)
                .withArgument("x-dead-letter-routing-key", QUEUE_EVENT_SYNC_DLQ)
                .build();
    }

    @Bean
    Queue eventSyncDlq() {
        return QueueBuilder.durable(QUEUE_EVENT_SYNC_DLQ).build();
    }

    // ══ Bindings ═══════════════════════════════════════════════════════════════
    @Bean
    Binding bindingEventSync() {
        return BindingBuilder.bind(eventSyncQueue())
                .to(discoveryExchange())
                .with(RK_EVENT_SYNC);
    }

    @Bean
    Binding bindingEventSyncDlq() {
        return BindingBuilder.bind(eventSyncDlq())
                .to(deadLetterExchange())
                .with(QUEUE_EVENT_SYNC_DLQ);
    }

    // ══ Message Converter ═════════════════════════════════════════════════════
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
     * Manual ACK + prefetch=1 — consistent with core-service pattern.
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
