package com.flashticket.discovery.shared.messaging;



public final class DiscoveryMQConstants {

    private DiscoveryMQConstants() {}

    // ── Exchange ──────────────────────────────────────────────────────────────
    public static final String EXCHANGE_DISCOVERY = "ex.discovery";
    public static final String EXCHANGE_DEAD_LETTER = "ex.dead-letter";

    // ── Routing keys ─────────────────────────────────────────────────────────
    public static final String RK_EVENT_SYNC = "event.sync";

    // ── Queue names ──────────────────────────────────────────────────────────
    public static final String QUEUE_EVENT_SYNC = "q.discovery.event.sync";
    public static final String QUEUE_EVENT_SYNC_DLQ = "q.discovery.event.sync.dlq";
}
