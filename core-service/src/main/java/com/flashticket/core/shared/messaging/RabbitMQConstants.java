package com.flashticket.core.shared.messaging;


public final class RabbitMQConstants {

    private RabbitMQConstants() {}

    // ── Exchange names ────────────────────────────────────────────────────────
    public static final String EXCHANGE_PAYMENT  = "ex.payment"; // cấp vé
    public static final String EXCHANGE_TICKET   = "ex.ticket";  // gửi mail
    public static final String EXCHANGE_DEAD_LETTER = "ex.dead-letter"; // nack

    // ── Routing keys ─────────────────────────────────────────────────────────
    public static final String RK_PAYMENT_SUCCESS = "payment.success";
    public static final String RK_TICKET_ISSUED   = "ticket.issued";

    // ── Queue names ───────────────────────────────────────────────────────────
    public static final String QUEUE_TICKET_ISSUE = "q.ticket.issue";
    public static final String QUEUE_EMAIL_SEND   = "q.email.send";
    public static final String QUEUE_TICKET_DLQ   = "q.ticket.issue.dlq";
    public static final String QUEUE_EMAIL_DLQ    = "q.email.send.dlq";

    // ── Discovery Service sync ──────────────────────────────────────────────
    public static final String EXCHANGE_DISCOVERY = "ex.discovery";
    public static final String RK_EVENT_SYNC = "event.sync";
    public static final String QUEUE_EVENT_SYNC = "q.discovery.event.sync";
    public static final String QUEUE_EVENT_SYNC_DLQ = "q.discovery.event.sync.dlq";

}
