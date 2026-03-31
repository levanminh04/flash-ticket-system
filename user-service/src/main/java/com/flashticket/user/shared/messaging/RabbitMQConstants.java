package com.flashticket.user.shared.messaging;

/**
 * RabbitMQ Constants — User Service
 *
 * Topology: Keycloak SPI → Exchange (keycloak.events) → Queue (q.keycloak.user.sync)
 * User Service lắng nghe queue này để sync user vào MongoDB.
 */
public final class RabbitMQConstants {

    private RabbitMQConstants() {}

    // ── Exchange ──────────────────────────────────────────────────────────────
    /** Exchange nhận các sự kiện từ Keycloak Event Listener SPI */
    public static final String EXCHANGE_KEYCLOAK_EVENTS = "keycloak.events";

    // ── Queues ────────────────────────────────────────────────────────────────
    /** Queue đồng bộ user mới đăng ký / cập nhật profile từ Keycloak */
    public static final String QUEUE_USER_SYNC       = "q.keycloak.user.sync";
    public static final String QUEUE_USER_SYNC_DLQ   = "q.keycloak.user.sync.dlq";

    // ── Routing Keys ─────────────────────────────────────────────────────────
    /** Keycloak SPI gửi event khi user REGISTER */
    public static final String RK_USER_REGISTER      = "user.register";
    /** Keycloak SPI gửi event khi user UPDATE_EMAIL hoặc UPDATE_PROFILE */
    public static final String RK_USER_UPDATE        = "user.update";
    /** Keycloak SPI gửi event khi admin DELETE_ACCOUNT */
    public static final String RK_USER_DELETE        = "user.delete";
}
