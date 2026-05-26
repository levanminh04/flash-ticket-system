package com.flashticket.core.event.service;

import com.flashticket.core.common.exception.InvalidRequestException;
import com.flashticket.core.common.exception.ResourceNotFoundException;
import com.flashticket.core.event.dto.*;
import com.flashticket.core.event.entity.*;
import com.flashticket.core.event.repository.*;
import com.flashticket.core.shared.event.EventSyncHelper;
import com.flashticket.core.shared.event.EventSyncSpringEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.regex.Pattern;

/**
 * nghiệp vụ Event CRUD phía Organizer.
 *
 * IDOR Protection: Mọi write-op đều verify organizerId == currentUser.
 * Atomic Update: Dùng @Modifying query cho totalCapacity, ticketsSold.
 * Slug: Auto-generate từ title, đảm bảo unique.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OrganizerEventService {

    private final EventRepository eventRepository;
    private final CategoryRepository categoryRepository;
    private final VenueRepository venueRepository;
    private final TicketTypeRepository ticketTypeRepository;
    private final ApplicationEventPublisher eventPublisher;

    private record EventLiveStats(int ticketsSold, int totalCapacity) {
        static EventLiveStats empty() {
            return new EventLiveStats(0, 0);
        }
    }

    // ═══════════════════════════════════════════════════════
    // READ
    // ═══════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public Page<EventDetailResponse> getMyEvents(String organizerId, Pageable pageable) {
        log.debug("Fetching events for organizer: {}", organizerId);
        Page<Event> events = eventRepository.findByOrganizerIdAndIsDeletedFalse(organizerId, pageable);
        Map<UUID, EventLiveStats> liveStatsByEventId = loadLiveStats(events.getContent());
        return events.map(event -> mapToDetailResponse(
            event,
            liveStatsByEventId.getOrDefault(event.getId(), EventLiveStats.empty())));
    }

    @Transactional(readOnly = true)
    public EventDetailResponse getMyEvent(UUID eventId, String organizerId) {
        Event event = findOwnedEvent(eventId, organizerId);
        return mapToDetailResponse(event, loadLiveStats(event));
    }

    // ═══════════════════════════════════════════════════════
    // CREATE
    // ═══════════════════════════════════════════════════════

    @Transactional
    public EventDetailResponse createEvent(CreateEventRequest req, String organizerId, String organizerName) {
        log.info("Creating event '{}' for organizer: {}", req.title(), organizerId);

        // Validate dates
        validateEventDates(req.startDatetime(), req.endDatetime());

        // Venue validation (nếu có)
        Venue venue = null;
        if (req.venueId() != null) {
            // Venue FK nằm trong cùng event_schema — không cần cross-DB
            venue = findVenue(req.venueId());
        }

        // Generate unique slug from title
        String slug = generateUniqueSlug(req.title());

        // Build Event entity
        Event event = Event.builder()
            .title(req.title())
            .slug(slug)
            .shortDescription(req.shortDescription())
            .description(req.description())
            .tags(req.tags())
            .startDatetime(req.startDatetime())
            .endDatetime(req.endDatetime())
            .timezone(StringUtils.hasText(req.timezone()) ? req.timezone() : "Asia/Ho_Chi_Minh")
            .venue(venue)
            .isOnline(req.isOnline() != null ? req.isOnline() : false)
            .onlineEventUrl(req.onlineEventUrl())
            .organizerId(organizerId)
            .organizerName(organizerName)
            .saleStartDatetime(req.saleStartDatetime())
            .saleEndDatetime(req.saleEndDatetime())
            .minTicketsPerOrder(req.minTicketsPerOrder() != null ? req.minTicketsPerOrder() : 1)
            .maxTicketsPerOrder(req.maxTicketsPerOrder() != null ? req.maxTicketsPerOrder() : 10)
            .visibility(resolveVisibility(req.visibility()))
            .status(Event.EventStatus.DRAFT)
            .metaTitle(req.metaTitle())
            .metaDescription(req.metaDescription())
            .metaKeywords(req.metaKeywords())
            .isDeleted(false)
            .isFeatured(false)
            .totalCapacity(0)
            .ticketsSold(0)
            .viewCount(0)
            .build();

        event = eventRepository.save(event);

        // Gắn categories
        if (req.categoryIds() != null && !req.categoryIds().isEmpty()) {
            List<Category> categories = categoryRepository.findAllById(req.categoryIds());
            event.setCategories(categories);
            eventRepository.save(event);
        }

        log.info("Created event id={}, slug={}", event.getId(), event.getSlug());
        // Note: Event is DRAFT at creation — sync to discovery only on PUBLISH
        return mapToDetailResponse(event);
    }

    // ═══════════════════════════════════════════════════════
    // UPDATE
    // ═══════════════════════════════════════════════════════

    @Transactional
    public EventDetailResponse updateEvent(UUID eventId, UpdateEventRequest req, String organizerId) {
        log.info("Updating event {} by organizer {}", eventId, organizerId);

        Event event = findOwnedEvent(eventId, organizerId);

        // Chặn sửa event đã hoàn thành hoặc đã bị xóa
        if (event.getStatus() == Event.EventStatus.COMPLETED) {
            throw new InvalidRequestException("Không thể sửa sự kiện đã kết thúc");
        }

        // Chặn sửa thời gian nếu đã có vé bán
        if ((req.startDatetime() != null || req.endDatetime() != null) && event.getTicketsSold() > 0) {
            throw new InvalidRequestException(
                "Không thể thay đổi thời gian sự kiện khi đã có vé được bán (" + event.getTicketsSold() + " vé)");
        }

        // Partial update — chỉ update field nào được truyền vào (khác null)
        if (StringUtils.hasText(req.title())) {
            event.setTitle(req.title());
        }
        if (req.shortDescription() != null) event.setShortDescription(req.shortDescription());
        if (req.description() != null) event.setDescription(req.description());
        if (req.tags() != null) event.setTags(req.tags());

        if (req.startDatetime() != null) {
            validateEventDates(req.startDatetime(),
                req.endDatetime() != null ? req.endDatetime() : event.getEndDatetime());
            event.setStartDatetime(req.startDatetime());
        }
        if (req.endDatetime() != null) {
            validateEventDates(
                req.startDatetime() != null ? req.startDatetime() : event.getStartDatetime(),
                req.endDatetime());
            event.setEndDatetime(req.endDatetime());
        }
        if (StringUtils.hasText(req.timezone())) event.setTimezone(req.timezone());
        if (req.venueId() != null) event.setVenue(findVenue(req.venueId()));
        if (req.isOnline() != null) event.setIsOnline(req.isOnline());
        if (req.onlineEventUrl() != null) event.setOnlineEventUrl(req.onlineEventUrl());
        if (req.saleStartDatetime() != null) event.setSaleStartDatetime(req.saleStartDatetime());
        if (req.saleEndDatetime() != null) event.setSaleEndDatetime(req.saleEndDatetime());
        if (req.minTicketsPerOrder() != null) event.setMinTicketsPerOrder(req.minTicketsPerOrder());
        if (req.maxTicketsPerOrder() != null) event.setMaxTicketsPerOrder(req.maxTicketsPerOrder());
        if (StringUtils.hasText(req.visibility())) event.setVisibility(resolveVisibility(req.visibility()));
        if (req.metaTitle() != null) event.setMetaTitle(req.metaTitle());
        if (req.metaDescription() != null) event.setMetaDescription(req.metaDescription());
        if (req.metaKeywords() != null) event.setMetaKeywords(req.metaKeywords());

        // Cập nhật categories nếu được truyền vào
        if (req.categoryIds() != null) {
            List<Category> categories = categoryRepository.findAllById(req.categoryIds());
            event.setCategories(categories);
        }

        event = eventRepository.save(event);

        // Sync to discovery only if event is published (visible to users)
        if (event.getStatus() == Event.EventStatus.PUBLISHED) {
            eventPublisher.publishEvent(new EventSyncSpringEvent(
                EventSyncHelper.buildSyncData(event, "UPDATED"), "UPDATED"));
        }

        log.info("Updated event id={}", event.getId());
        return mapToDetailResponse(event);
    }

    // ═══════════════════════════════════════════════════════
    // STATUS TRANSITIONS
    // ═══════════════════════════════════════════════════════

    @Transactional
    public EventDetailResponse publishEvent(UUID eventId, String organizerId) {
        Event event = findOwnedEvent(eventId, organizerId);

        if (event.getStatus() != Event.EventStatus.DRAFT) {
            throw new InvalidRequestException(
                "Chỉ có thể publish sự kiện ở trạng thái DRAFT. Trạng thái hiện tại: " + event.getStatus());
        }

        // Validate: phải có ít nhất 1 TicketType ACTIVE
        long activeTicketTypes = eventRepository.countActiveTicketTypes(eventId);
        if (activeTicketTypes == 0) {
            throw new InvalidRequestException(
                "Sự kiện phải có ít nhất 1 loại vé đang hoạt động trước khi có thể công bố");
        }

        event.setStatus(Event.EventStatus.PUBLISHED);
        event = eventRepository.save(event);

        eventPublisher.publishEvent(new EventSyncSpringEvent(
                EventSyncHelper.buildSyncData(event, "PUBLISHED"), "PUBLISHED"));

        log.info("Published event id={}", event.getId());
        return mapToDetailResponse(event);
    }

    @Transactional
    public EventDetailResponse cancelEvent(UUID eventId, String organizerId) {
        Event event = findOwnedEvent(eventId, organizerId);

        if (event.getStatus() == Event.EventStatus.CANCELLED) {
            throw new InvalidRequestException("Sự kiện đã bị hủy rồi");
        }
        if (event.getStatus() == Event.EventStatus.COMPLETED) {
            throw new InvalidRequestException("Không thể hủy sự kiện đã kết thúc");
        }

        if (event.getTicketsSold() > 0) {
            // Cảnh báo nhưng vẫn cho phép cancel (Organizer chịu trách nhiệm hoàn tiền)
            log.warn("Organizer {} cancelling event {} which has {} tickets sold",
                organizerId, eventId, event.getTicketsSold());
        }

        event.setStatus(Event.EventStatus.CANCELLED);
        event = eventRepository.save(event);

        eventPublisher.publishEvent(new EventSyncSpringEvent(
                EventSyncHelper.buildSyncData(event, "DELETED"), "DELETED"));

        log.info("Cancelled event id={}", event.getId());
        return mapToDetailResponse(event);
    }

    // ═══════════════════════════════════════════════════════
    // DELETE (Soft)
    // ═══════════════════════════════════════════════════════

    @Transactional
    public void deleteEvent(UUID eventId, String organizerId) {
        Event event = findOwnedEvent(eventId, organizerId);

        // Chặn xóa nếu còn vé đã bán
        if (event.getTicketsSold() > 0) {
            throw new InvalidRequestException(
                "Không thể xóa sự kiện đã có vé được bán (" + event.getTicketsSold() + " vé). " +
                "Hãy hủy sự kiện thay vì xóa.");
        }

        event.setIsDeleted(true);
        event.setDeletedAt(Instant.now());
        event.setStatus(Event.EventStatus.CANCELLED);
        eventRepository.save(event);

        eventPublisher.publishEvent(new EventSyncSpringEvent(
                EventSyncHelper.buildSyncData(event, "DELETED"), "DELETED"));

        log.info("Soft deleted event id={} by organizer {}", eventId, organizerId);
    }

    // ═══════════════════════════════════════════════════════
    // PRIVATE HELPERS
    // ═══════════════════════════════════════════════════════

    /**
     * Tìm event thuộc về organizer — IDOR protection.
     * Ném 404 thay vì 403 để tránh leaking thông tin về sự tồn tại của resource.
     */
    private Event findOwnedEvent(UUID eventId, String organizerId) {
        return eventRepository.findByIdAndOrganizerIdAndIsDeletedFalse(eventId, organizerId)
            .orElseThrow(() -> new ResourceNotFoundException("Sự kiện không tồn tại: " + eventId));
    }

    private Venue findVenue(UUID venueId) {
        log.info("Finding venue by id: {}", venueId);
        return venueRepository.findById(venueId)
            .orElseThrow(() -> new ResourceNotFoundException("Venue", "id", venueId));
    }

    private void validateEventDates(Instant start, Instant end) {
        if (start == null || end == null) return;
        if (!end.isAfter(start)) {
            throw new InvalidRequestException("Thời gian kết thúc phải sau thời gian bắt đầu");
        }
        if (start.isBefore(Instant.now())) {
            throw new InvalidRequestException("Thời gian bắt đầu không được trong quá khứ");
        }
    }

    private Event.EventVisibility resolveVisibility(String visibility) {
        if (!StringUtils.hasText(visibility)) return Event.EventVisibility.PUBLIC;
        try {
            return Event.EventVisibility.valueOf(visibility.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new InvalidRequestException("Visibility không hợp lệ: " + visibility +
                ". Các giá trị hợp lệ: PUBLIC, PRIVATE, UNLISTED");
        }
    }

    /**
     * Tạo slug URL-friendly từ title.
     * "Rock Storm 2026" → "rock-storm-2026"
     * Nếu trùng: "rock-storm-2026-2", "rock-storm-2026-3", ...
     */
    String generateUniqueSlug(String title) {
        String base = slugify(title);
        if (!eventRepository.existsBySlugAndIsDeletedFalse(base)) {
            return base;
        }
        // Append counter until unique
        for (int i = 2; i <= 100; i++) {
            String candidate = base + "-" + i;
            if (!eventRepository.existsBySlugAndIsDeletedFalse(candidate)) {
                return candidate;
            }
        }
        // Fallback: base + timestamp
        return base + "-" + System.currentTimeMillis();
    }

    private static final Pattern NON_LATIN = Pattern.compile("[^\\w-]");
    private static final Pattern WHITESPACE = Pattern.compile("[\\s_]+");

    private String slugify(String input) {
        // Normalize Unicode (Vietnamese → ASCII)
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFD);
        // Xóa dấu
        normalized = normalized.replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        // Vietnamese đặc biệt không normalize được
        normalized = normalized
            .replace("đ", "d").replace("Đ", "d")
            .toLowerCase()
            .trim();
        // Thay whitespace bằng dấu gạch
        normalized = WHITESPACE.matcher(normalized).replaceAll("-");
        // Xóa ký tự không hợp lệ
        normalized = NON_LATIN.matcher(normalized).replaceAll("");
        // Xóa dấu gạch đầu/cuối
        return normalized.replaceAll("^-+|-+$", "").replaceAll("-{2,}", "-");
    }

    /**
     * Map Event entity sang EventDetailResponse DTO.
     * Tái sử dụng EventService.mapToEventDetailResponse() logic.
     */
    private EventDetailResponse mapToDetailResponse(Event event) {
        return mapToDetailResponse(event, loadLiveStats(event));
    }

    private EventDetailResponse mapToDetailResponse(Event event, EventLiveStats liveStats) {
        return EventDetailResponse.builder()
            .id(event.getId())
            .title(event.getTitle())
            .slug(event.getSlug())
            .description(event.getDescription())
            .shortDescription(event.getShortDescription())
            .tags(event.getTags())
            .images(mapImages(event.getImages()))
            .categories(mapCategories(event.getCategories()))
            .ticketTypes(mapTicketTypes(event.getTicketTypes()))
            .venue(mapVenue(event.getVenue()))
            .schedule(mapSchedule(event))
            .config(mapConfig(event))
            .statistics(mapStatistics(event, liveStats))
            .organizer(OrganizerDTO.builder()
                .id(event.getOrganizerId())
                .name(event.getOrganizerName())
                .logoUrl(event.getOrganizerLogoUrl())
                .build())
            .status(event.getStatus() != null ? event.getStatus().name() : null)
            .isFeatured(event.getIsFeatured())
            .isOnline(event.getIsOnline())
            .onlineEventUrl(event.getOnlineEventUrl())
            .createdAt(event.getCreatedAt())
            .updatedAt(event.getUpdatedAt())
            .build();
    }

    private Map<UUID, EventLiveStats> loadLiveStats(List<Event> events) {
        if (events == null || events.isEmpty()) {
            return Map.of();
        }

        List<UUID> eventIds = events.stream()
            .map(Event::getId)
            .toList();

        return eventRepository.findLiveOrganizerStatsByEventIds(eventIds).stream()
            .collect(Collectors.toMap(
                row -> (UUID) row[0],
                row -> new EventLiveStats(toInt(row[1]), toInt(row[2]))
            ));
    }

    private EventLiveStats loadLiveStats(Event event) {
        return loadLiveStats(List.of(event)).getOrDefault(event.getId(), EventLiveStats.empty());
    }

    private int toInt(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        return 0;
    }

    private List<EventImageDTO> mapImages(List<EventImage> images) {
        if (images == null) return List.of();
        return images.stream()
            .filter(img -> !img.getIsDeleted())
            .map(img -> EventImageDTO.builder()
                .id(img.getId())
                .url(img.getImageUrl())
                .type(img.getImageType().name())
                .isPrimary(img.getIsPrimary())
                .displayOrder(img.getDisplayOrder())
                .build())
            .toList();
    }

    private List<CategoryDTO> mapCategories(List<Category> categories) {
        if (categories == null) return List.of();
        return categories.stream()
            .map(cat -> CategoryDTO.builder()
                .id(cat.getId())
                .name(cat.getName())
                .slug(cat.getSlug())
                .build())
            .toList();
    }

    private List<TicketTypeDTO> mapTicketTypes(List<TicketType> ticketTypes) {
        if (ticketTypes == null) return List.of();
        return ticketTypes.stream()
            .filter(tt -> !tt.getIsDeleted())
            .map(tt -> TicketTypeDTO.builder()
                .id(tt.getId())
                .name(tt.getName())
                .description(tt.getDescription())
                .price(tt.getPrice())
                .originalPrice(tt.getOriginalPrice())
                .currency(tt.getCurrency())
                .quantityTotal(tt.getQuantityTotal())
                .quantityAvailable(tt.getQuantityAvailable())
                .eventSectorId(tt.getEventSectorId())
                .inventoryMode(tt.getInventoryMode() != null ? tt.getInventoryMode().name() : null)
                .accessScope(tt.getAccessScope() != null ? tt.getAccessScope().name() : null)
                .maxPerOrder(tt.getMaxPerOrder())
                .saleStartDatetime(tt.getSaleStartDatetime())
                .saleEndDatetime(tt.getSaleEndDatetime())
                .seatSelectionEnabled(tt.getSeatSelectionEnabled())
                .status(tt.getStatus() != null ? tt.getStatus().name() : null)
                .colorCode(tt.getColorCode())
                .displayOrder(tt.getDisplayOrder())
                .build())
            .toList();
    }

    private VenueDTO mapVenue(Venue venue) {
        if (venue == null) return null;
        return VenueDTO.builder()
            .id(venue.getId())
            .name(venue.getName())
            .slug(venue.getSlug())
            .address(venue.getAddress())
            .city(venue.getCity())
            .latitude(venue.getLatitude() != null ? venue.getLatitude().doubleValue() : null)
            .longitude(venue.getLongitude() != null ? venue.getLongitude().doubleValue() : null)
            .totalCapacity(venue.getTotalCapacity())
            .facilities(venue.getFacilities())
            .build();
    }

    private ScheduleDTO mapSchedule(Event event) {
        return ScheduleDTO.builder()
            .startDatetime(event.getStartDatetime())
            .endDatetime(event.getEndDatetime())
            .timezone(event.getTimezone())
            .saleStartDatetime(event.getSaleStartDatetime())
            .saleEndDatetime(event.getSaleEndDatetime())
            .build();
    }

    private ConfigDTO mapConfig(Event event) {
        return ConfigDTO.builder()
            .minTicketsPerOrder(event.getMinTicketsPerOrder())
            .maxTicketsPerOrder(event.getMaxTicketsPerOrder())
            .visibility(event.getVisibility() != null ? event.getVisibility().name() : null)
            .build();
    }

    private StatisticsDTO mapStatistics(Event event, EventLiveStats liveStats) {
        return StatisticsDTO.builder()
            .viewCount(event.getViewCount())
            .ticketsSold(liveStats.ticketsSold())
            .totalCapacity(liveStats.totalCapacity())
            .build();
    }
}
