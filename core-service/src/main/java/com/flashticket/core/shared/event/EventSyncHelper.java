package com.flashticket.core.shared.event;

import com.flashticket.core.event.entity.Event;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Build sync message data TRONG transaction — nơi Hibernate session còn mở.
 * Gọi hàm này TRƯỚC khi ApplicationEventPublisher.publishEvent().
 *
 * Extract tất cả lazy fields tại đây:
 * - event.getVenue().getName()     → Venue proxy được initialize
 * - event.getCategories()          → Categories proxy được initialize
 * - event.getTags()                → JSONB, không lazy nhưng có thể null
 */
public final class EventSyncHelper {

    private EventSyncHelper() {}

    /**
     * Build Map chứa toàn bộ data cần sync. Gọi TRONG @Transactional method.
     */
    public static Map<String, Object> buildSyncData(Event event, String action) {
        Map<String, Object> map = new HashMap<>();
        map.put("eventId", event.getId());
        map.put("title", nullSafe(event.getTitle()));
        map.put("description", nullSafe(event.getDescription()));
        map.put("shortDescription", nullSafe(event.getShortDescription()));
        map.put("status", action);
        map.put("organizerId", nullSafe(event.getOrganizerId()));
        map.put("organizerName", nullSafe(event.getOrganizerName()));
        map.put("startDatetime", event.getStartDatetime() != null ? event.getStartDatetime().toString() : "");
        map.put("endDatetime", event.getEndDatetime() != null ? event.getEndDatetime().toString() : "");

        // Venue — LAZY proxy → initialize tại đây (trong transaction)
        try {
            map.put("venueName", event.getVenue() != null ? nullSafe(event.getVenue().getName()) : "");
            map.put("venueAddress", event.getVenue() != null ? nullSafe(event.getVenue().getAddress()) : "");
        } catch (Exception e) {
            map.put("venueName", "");
            map.put("venueAddress", "");
        }

        map.put("minPrice", event.getMinPrice());

        // Categories — LAZY collection → initialize tại đây (trong transaction)
        try {
            map.put("categories", event.getCategories() != null
                    ? event.getCategories().stream().map(c -> c.getName()).toList()
                    : List.of());
        } catch (Exception e) {
            map.put("categories", List.of());
        }

        map.put("tags", event.getTags() != null ? event.getTags() : List.of());

        return map;
    }

    private static String nullSafe(String s) {
        return s != null ? s : "";
    }
}
