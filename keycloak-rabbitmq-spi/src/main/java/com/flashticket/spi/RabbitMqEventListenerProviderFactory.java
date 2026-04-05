package com.flashticket.spi;

import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;
import org.jboss.logging.Logger;
import org.keycloak.Config;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventListenerProviderFactory;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.KeycloakSessionFactory;

public class RabbitMqEventListenerProviderFactory implements EventListenerProviderFactory {

    private static final Logger log = Logger.getLogger(RabbitMqEventListenerProviderFactory.class);
    private static final String ID = "rabbitmq-event-listener";

    private Connection connection;
    private String exchange;

    /**
     * User đăng ký tài khoản
     *         ↓
     * Keycloak xử lý xong
     *         ↓
     * Keycloak gọi Factory.create()  ← tạo Provider mới
     *         ↓
     * Keycloak gọi Provider.onEvent()  ← xử lý event
     *         ↓
     * Keycloak gọi Provider.close()  ← dọn dẹp*/
    @Override // create() được gọi mỗi khi có event xảy ra, không phải mỗi HTTP request.
    public EventListenerProvider create(KeycloakSession session) {
        return new RabbitMqEventListenerProvider(session, connection, exchange);
        //Chạy nhiều lần -> không tạo resource nặng ở đây (không tạo connection mới)
        //KeycloakSession chỉ sống trong 1 request -> không lưu lại dùng sau
    }

    @Override
    public void init(Config.Scope config) {
        log.info("Initializing RabbitMQ Event Listener Factory...");

        try {
            String host = System.getenv().getOrDefault("KC_SPI_EVENTS_LISTENER_RABBITMQ_HOST", "rabbitmq");
            int port = Integer.parseInt(System.getenv().getOrDefault("KC_SPI_EVENTS_LISTENER_RABBITMQ_PORT", "5672"));
            String username = System.getenv().getOrDefault("KC_SPI_EVENTS_LISTENER_RABBITMQ_USERNAME", "guest");
            String password = System.getenv().getOrDefault("KC_SPI_EVENTS_LISTENER_RABBITMQ_PASSWORD", "guest");
            this.exchange = System.getenv().getOrDefault("KC_SPI_EVENTS_LISTENER_RABBITMQ_EXCHANGE", "keycloak.events");

            ConnectionFactory factory = new ConnectionFactory();
            factory.setHost(host);
            factory.setPort(port);
            factory.setUsername(username);
            factory.setPassword(password);
            
            // Automatic recovery config
            factory.setAutomaticRecoveryEnabled(true);
            factory.setNetworkRecoveryInterval(10000);

            this.connection = factory.newConnection();
            log.infov("Successfully connected to RabbitMQ at {0}:{1}", host, port);

        } catch (Exception e) {
            log.error("Failed to connect to RabbitMQ", e);
            //  try/catch cẩn thận — nếu throw exception có thể làm Keycloak không start được
        }
    }

    @Override
    public void postInit(KeycloakSessionFactory factory) {
        // Not needed for this implementation
    }

    @Override
    public void close() { //  Dọn dẹp khi Keycloak shutdown
        try {
            if (connection != null && connection.isOpen()) {
                connection.close();
                log.info("RabbitMQ connection closed.");
            }
        } catch (Exception e) {
            log.error("Error closing RabbitMQ connection", e);
        }
    }

    @Override
    public String getId() { // Tên này hiển thị trong Keycloak Admin UI để bật/tắt
        return ID;
    }
}
