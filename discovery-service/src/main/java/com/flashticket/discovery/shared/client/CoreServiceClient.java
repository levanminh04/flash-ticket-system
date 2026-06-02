package com.flashticket.discovery.shared.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.UUID;

/**
 * REST client gọi core-service qua Eureka load balancer.
 * Forward JWT gốc của user để core-service validate IDOR.
 *
 * Dùng RestClient (Spring 6.1+) — nhất quán với pattern hiện tại.
 */
@Component
@Slf4j
public class CoreServiceClient {

    private final RestClient restClient;

    public CoreServiceClient(
            RestClient.Builder builder,
            @Value("${app.core-service.base-url}") String baseUrl) {
        this.restClient = builder.baseUrl(baseUrl).build();
    }

    /** POST /api/bookings — Tạo booking mới */
    public String createBooking(String jwt, CreateBookingPayload payload) {
        try {
            return restClient.post()
                    .uri("/api/bookings")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwt)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(String.class);
        } catch (RestClientResponseException e) {
            log.error("[CoreClient] Booking failed: {} — {}", e.getStatusCode(), e.getResponseBodyAsString());
            return "ERROR: " + extractErrorMessage(e);
        }
    }

    /** POST /api/payments/initiate — Tạo payment URL */
    public String initiatePayment(String jwt, PaymentInitPayload payload) {
        try {
            return restClient.post()
                    .uri("/api/payments/initiate")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwt)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(String.class);
        } catch (RestClientResponseException e) {
            log.error("[CoreClient] Payment failed: {} — {}", e.getStatusCode(), e.getResponseBodyAsString());
            return "ERROR: " + extractErrorMessage(e);
        }
    }

    /** GET /api/events (public) — Search events */
    public String searchEvents(String query, int page, int size) {
        return restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/events")
                        .queryParam("keyword", query)
                        .queryParam("page", page)
                        .queryParam("size", size)
                        .build())
                .retrieve()
                .body(String.class);
    }

    /** GET /api/events (public) — Lấy TẤT CẢ events (không filter) cho admin reindex */
    public String searchAllEvents(int page, int size) {
        return restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/events")
                        .queryParam("page", page)
                        .queryParam("size", size)
                        .build())
                .retrieve()
                .body(String.class);
    }

    /** GET /api/events/{id} (public) — Event detail */
    public String getEventDetail(String eventId) {
        return restClient.get()
                .uri("/api/events/{id}", eventId)
                .retrieve()
                .body(String.class);
    }

    private String extractErrorMessage(RestClientResponseException e) {
        try {
            var body = e.getResponseBodyAsString();
            if (body.contains("message")) {
                return body;
            }
            return e.getStatusText();
        } catch (Exception ex) {
            return e.getMessage();
        }
    }

    // ── Payload records ──────────────────────────────────────────────────────
    public record CreateBookingPayload(
        UUID eventId,
        List<BookingItem> items,
        String customerName, String customerEmail,
        String customerPhone, String promotionCode,
        String customerNote
    ) {
        public record BookingItem(UUID ticketTypeId, int quantity) {}
    }

    public record PaymentInitPayload(
        UUID orderId,
        String bankCode,
        String provider
    ) {}
}
