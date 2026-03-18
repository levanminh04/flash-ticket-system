package com.flashticket.core.shared.messaging;

/**
 * RabbitMQ Constants
 * Cung cấp tên Queue, Exchange, Routing Key thống nhất cho các module khác nhau
 * mà không cần phải import chéo các Config class.
 */
public final class RabbitMQConstants {

    private RabbitMQConstants() {}

    // ── Exchange names ────────────────────────────────────────────────────────
    public static final String EXCHANGE_PAYMENT  = "ex.payment";
    public static final String EXCHANGE_TICKET   = "ex.ticket";
    public static final String EXCHANGE_DEAD_LETTER = "ex.dead-letter";

    // ── Routing keys ─────────────────────────────────────────────────────────
    public static final String RK_PAYMENT_SUCCESS = "payment.success";
    public static final String RK_TICKET_ISSUED   = "ticket.issued";

    // ── Queue names ───────────────────────────────────────────────────────────
    public static final String QUEUE_TICKET_ISSUE = "q.ticket.issue";
    public static final String QUEUE_EMAIL_SEND   = "q.email.send";
    public static final String QUEUE_TICKET_DLQ   = "q.ticket.issue.dlq";
    public static final String QUEUE_EMAIL_DLQ    = "q.email.send.dlq";

}
