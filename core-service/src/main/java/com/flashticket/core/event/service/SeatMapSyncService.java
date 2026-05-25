package com.flashticket.core.event.service;

import com.flashticket.core.common.exception.InvalidRequestException;
import com.flashticket.core.common.exception.ResourceNotFoundException;
import com.flashticket.core.booking.event.SeatStatusChangedEvent;
import com.flashticket.core.event.dto.SeatMapPublishRequest;
import com.flashticket.core.event.dto.SeatMapResponse;
import com.flashticket.core.event.entity.Event;
import com.flashticket.core.event.entity.EventLayout;
import com.flashticket.core.event.entity.EventSeat;
import com.flashticket.core.event.entity.EventSeatInventory;
import com.flashticket.core.event.entity.EventSector;
import com.flashticket.core.event.entity.TicketType;
import com.flashticket.core.event.entity.TicketType.InventoryMode;
import com.flashticket.core.event.repository.EventLayoutRepository;
import com.flashticket.core.event.repository.EventRepository;
import com.flashticket.core.event.repository.EventSeatInventoryRepository;
import com.flashticket.core.event.repository.EventSeatRepository;
import com.flashticket.core.event.repository.EventSectorRepository;
import com.flashticket.core.event.repository.TicketTypeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.redisson.api.RMapCache;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SeatMapSyncService {

    private static final List<String> PROTECTED_STATUSES = List.of("RESERVED", "SOLD");
    private static final String DEFAULT_SECTOR_TYPE = "SEATED";
    private static final String DEFAULT_SEAT_TYPE = "REGULAR";
    private static final String SEATED = "SEATED";
    private static final String STANDING = "STANDING";

    private final EventRepository eventRepository;
    private final EventLayoutRepository eventLayoutRepository;
    private final EventSectorRepository eventSectorRepository;
    private final EventSeatRepository eventSeatRepository;
    private final EventSeatInventoryRepository eventSeatInventoryRepository;
    private final TicketTypeRepository ticketTypeRepository;
    private final RedissonClient redissonClient;
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Organizer/editor view: includes inactive sectors and seats.
     */
    @Transactional(readOnly = true)
    public SeatMapResponse getSeatMap(UUID eventId, String organizerId) {
        Event event = eventRepository.findByIdAndOrganizerIdAndIsDeletedFalse(eventId, organizerId)
            .orElseThrow(() -> new ResourceNotFoundException("Event not found: " + eventId));
        return buildSeatMap(event, true);
    }

    /**
     * Public buyer view: PUBLISHED events only, active sectors/seats only.
     */
    @Transactional(readOnly = true)
    public SeatMapResponse getPublicSeatMap(String idOrSlug) {
        Event event = resolveEvent(idOrSlug)
            .orElseThrow(() -> new ResourceNotFoundException("Event not found: " + idOrSlug));
        if (event.getStatus() != Event.EventStatus.PUBLISHED) {
            throw new ResourceNotFoundException("Event not found: " + idOrSlug);
        }
        return buildSeatMap(event, false);
    }

    @Transactional
    public SeatMapResponse publishSeatMap(UUID eventId, SeatMapPublishRequest payload, String organizerId) {
        if (payload == null) {
            throw new InvalidRequestException("Seat map payload is required");
        }

        Event event = eventRepository.findByIdAndOrganizerIdAndIsDeletedFalse(eventId, organizerId)
            .orElseThrow(() -> new ResourceNotFoundException("Event not found: " + eventId));
        EventLayout layout = eventLayoutRepository.findByEventId(eventId)
            .orElseThrow(() -> new ResourceNotFoundException("Event layout not found: " + eventId));

        List<EventSector> dbSectors = eventSectorRepository.findAllByLayoutId(layout.getId());
        Map<UUID, EventSector> dbSectorMap = dbSectors.stream()
            .collect(Collectors.toMap(EventSector::getId, Function.identity()));
        List<EventSeat> dbSeats = dbSectors.isEmpty()
            ? List.of()
            : eventSeatRepository.findAllBySectorIdIn(dbSectorMap.keySet());
        Map<UUID, EventSeat> dbSeatMap = dbSeats.stream()
            .collect(Collectors.toMap(EventSeat::getId, Function.identity()));
        Map<UUID, TicketType> ticketTypesById = ticketTypeRepository.findByEventIdAndIsDeletedFalse(eventId).stream()
            .collect(Collectors.toMap(TicketType::getId, Function.identity()));

        List<SeatMapPublishRequest.SectorPayload> sectorPayloads =
            payload.sectors() != null ? payload.sectors() : List.of();
        Set<UUID> payloadSectorIds = collectSectorIds(sectorPayloads);
        Set<UUID> payloadSeatIds = collectSeatIds(sectorPayloads);
        Set<UUID> existingPayloadSectorIds = payloadSectorIds.isEmpty()
            ? Set.of()
            : eventSectorRepository.findExistingIds(payloadSectorIds);
        Set<UUID> existingPayloadSeatIds = payloadSeatIds.isEmpty()
            ? Set.of()
            : eventSeatRepository.findExistingIds(payloadSeatIds);

        validatePayload(
            eventId,
            sectorPayloads,
            dbSectorMap,
            dbSeatMap,
            ticketTypesById,
            existingPayloadSectorIds,
            existingPayloadSeatIds
        );
        validateSafeMode(eventId, sectorPayloads, dbSectors, dbSeats);
        updateLayout(layout, payload);

        Map<UUID, SeatMapPublishRequest.SectorPayload> sectorPayloadMap = sectorPayloads.stream()
            .collect(Collectors.toMap(SeatMapPublishRequest.SectorPayload::id, Function.identity()));

        List<EventSector> sectorsToSave = new ArrayList<>();
        for (SeatMapPublishRequest.SectorPayload sectorPayload : sectorPayloads) {
            boolean sectorActive = isSectorActive(sectorPayload);
            String sectorType = normalizeSectorType(sectorPayload.sectorType());
            EventSector sector = dbSectorMap.get(sectorPayload.id());
            if (sector == null) {
                sector = new EventSector();
                sector.setId(sectorPayload.id());
                sector.setLayout(layout);
            }

            sector.setLayout(layout);
            sector.setName(sectorPayload.name().trim());
            sector.setCode(trimToNull(sectorPayload.code()));
            sector.setSectorType(sectorType);
            sector.setColorCode(normalizeColorCode(sectorPayload.colorCode(), "sector.colorCode"));
            sector.setDisplayOrder(sectorPayload.displayOrder() != null ? sectorPayload.displayOrder() : 0);
            sector.setTotalCapacity(resolveSectorCapacity(sectorPayload, sector, sectorType, sectorActive));
            sector.setMapData(buildSectorMapData(sectorPayload, sectorActive, false));
            sector.setIsActive(sectorActive);
            sectorsToSave.add(sector);
        }

        for (EventSector dbSector : dbSectors) {
            if (!sectorPayloadMap.containsKey(dbSector.getId())) {
                dbSector.setIsActive(false);
                dbSector.setMapData(markSectorInactive(dbSector.getMapData(), true));
                dbSector.setTotalCapacity(0);
                sectorsToSave.add(dbSector);
            }
        }

        List<EventSector> savedSectors = eventSectorRepository.saveAll(sectorsToSave);
        eventSectorRepository.flush();
        Map<UUID, EventSector> savedSectorMap = savedSectors.stream()
            .collect(Collectors.toMap(EventSector::getId, Function.identity(), (left, right) -> left));

        List<EventSeat> seatsToSave = new ArrayList<>();
        Set<UUID> handledSeatIds = new HashSet<>();
        Set<UUID> activeSeatedSectorIds = new HashSet<>();
        for (SeatMapPublishRequest.SectorPayload sectorPayload : sectorPayloads) {
            EventSector sector = savedSectorMap.get(sectorPayload.id());
            boolean sectorActive = isSectorActive(sectorPayload);
            String sectorType = normalizeSectorType(sectorPayload.sectorType());
            if (sectorActive && SEATED.equals(sectorType)) {
                activeSeatedSectorIds.add(sector.getId());
            }
            List<SeatMapPublishRequest.SeatPayload> seats =
                sectorPayload.seats() != null ? sectorPayload.seats() : List.of();

            for (SeatMapPublishRequest.SeatPayload seatPayload : seats) {
                EventSeat seat = dbSeatMap.get(seatPayload.id());
                if (seat == null) {
                    seat = new EventSeat();
                    seat.setId(seatPayload.id());
                }

                boolean seatActive = sectorActive && isSeatActive(seatPayload);
                UUID seatTicketTypeId = SEATED.equals(sectorType) ? seatPayload.ticketTypeId() : null;
                TicketType ticketType = seatTicketTypeId != null ? ticketTypesById.get(seatTicketTypeId) : null;

                seat.setSector(sector);
                seat.setRowName(seatPayload.rowName().trim());
                seat.setSeatNumber(seatPayload.seatNumber().trim());
                seat.setSeatLabel(trimToNull(seatPayload.seatLabel()));
                seat.setCoordX(seatPayload.coordX());
                seat.setCoordY(seatPayload.coordY());
                seat.setSeatType(defaultIfBlank(seatPayload.seatType(), DEFAULT_SEAT_TYPE));
                seat.setTicketTypeId(seatActive ? seatTicketTypeId : null);
                seat.setColorCode(resolveSeatColorSnapshot(ticketType, seatActive));
                seat.setCoordMetadata(buildSeatMapData(seatPayload, seatActive, false));
                seat.setIsActive(seatActive);
                seatsToSave.add(seat);
                handledSeatIds.add(seat.getId());
            }
        }

        for (EventSeat dbSeat : dbSeats) {
            if (!handledSeatIds.contains(dbSeat.getId())) {
                dbSeat.setIsActive(false);
                dbSeat.setCoordMetadata(markSeatInactive(dbSeat.getCoordMetadata(), true));
                seatsToSave.add(dbSeat);
            }
        }

        eventSeatRepository.saveAll(seatsToSave);
        eventSeatRepository.flush();

        for (UUID sectorId : activeSeatedSectorIds) {
            eventSeatInventoryRepository.bulkInsertInventoryForSector(eventId, sectorId);
            eventSeatInventoryRepository.syncAvailableTicketTypeFromSeatsForSector(eventId, sectorId);
        }
        for (UUID sectorId : savedSectorMap.keySet()) {
            eventSeatInventoryRepository.clearInactiveOrUnassignedTicketTypeSnapshotsForSector(eventId, sectorId);
        }

        syncAssignedSeatTicketCounters(eventId);
        if (event.getStatus() == Event.EventStatus.PUBLISHED) {
            publishSeatStatusSnapshot(eventId, activeSeatedSectorIds);
        } else {
            eventPublisher.publishEvent(new SeatStatusChangedEvent(eventId, Map.of(), true));
        }

        log.info("Published seat map for event {} with {} sectors", eventId, sectorPayloads.size());
        return buildSeatMap(event, true);
    }

    private SeatMapResponse buildSeatMap(Event event, boolean includeInactive) {
        EventLayout layout = eventLayoutRepository.findByEventId(event.getId()) // trước đó có filter theo organizer ID rồi nên không sợ organizer A sửa seatMap của organizer B
            .orElseThrow(() -> new ResourceNotFoundException("Event layout not found: " + event.getId()));

        List<EventSector> sectors = includeInactive
            ? eventSectorRepository.findAllByLayoutId(layout.getId())
            : eventSectorRepository.findByLayoutIdAndIsActiveTrue(layout.getId());

        Set<UUID> seatedSectorIds = sectors.stream()
            .filter(sector -> SEATED.equals(normalizeSectorType(sector.getSectorType())))
            .map(EventSector::getId)
            .collect(Collectors.toSet()); // lấy list seated sector

        Map<UUID, List<EventSeat>> seatsBySectorId = seatedSectorIds.isEmpty()
            ? Map.of()
            : eventSeatRepository.findAllBySectorIdIn(seatedSectorIds).stream()
                .filter(seat -> includeInactive || Boolean.TRUE.equals(seat.getIsActive()))
                .collect(Collectors.groupingBy(seat -> seat.getSector().getId())); // cẩn thận, Nếu có một sector SEATED nhưng chưa có ghế nào, thì seatsBySectorId sẽ không có key của sector đó.

        Map<UUID, String> inventoryStatusMap = readSeatStatus(event.getId(), includeInactive, seatedSectorIds);

        Map<UUID, TicketType> ticketTypesById = ticketTypeRepository.findByEventIdAndIsDeletedFalse(event.getId()).stream()
            .collect(Collectors.toMap(TicketType::getId, Function.identity())); // Function.identity() trả về chính TicketType

        List<SeatMapResponse.SectorDto> sectorDtos = sectors.stream()// duyệt sector (gồm cả seated và standing)
            .map(sector -> {
                String sectorType = normalizeSectorType(sector.getSectorType());
                List<SeatMapResponse.SeatDto> seatDtos = STANDING.equals(sectorType)
                    ? List.of() // standing thì trả list seats rỗng
                    : seatsBySectorId
                    .getOrDefault(sector.getId(), List.of()) // có thể có sector SEATED nhưng chưa có ghế nào, thì seatsBySectorId sẽ không có key của sector đó. cần getOrDefault.
                    .stream() // nếu dùng get() mà không phải getOrDefault() thì có thể trả về null => null.stream() => NullPointerException
                    .map(seat -> {
                        TicketType ticketType = seat.getTicketTypeId() != null
                            ? ticketTypesById.get(seat.getTicketTypeId())
                            : null;
                        return SeatMapResponse.SeatDto.builder()
                            .id(seat.getId())
                            .rowName(seat.getRowName())
                            .seatNumber(seat.getSeatNumber())
                            .seatLabel(seat.getSeatLabel())
                            .coordX(seat.getCoordX())
                            .coordY(seat.getCoordY())
                            .ticketTypeId(seat.getTicketTypeId())
                            .price(ticketType != null ? ticketType.getPrice() : null)
                            .colorCode(resolveSeatColor(ticketType))
                            .seatType(seat.getSeatType())
                            .isActive(seat.getIsActive())
                            .inventoryStatus(resolveInventoryStatus(inventoryStatusMap, seat.getId(), includeInactive))
                            .build();
                    })
                    .toList();

                return SeatMapResponse.SectorDto.builder()
                    .id(sector.getId())
                    .name(sector.getName())
                    .code(sector.getCode())
                    .sectorType(sectorType)
                    .totalCapacity(sector.getTotalCapacity())
                    .mapData(sector.getMapData())
                    .colorCode(sector.getColorCode())
                    .displayOrder(sector.getDisplayOrder())
                    .isActive(sector.getIsActive())
                    .seatsData(seatDtos)
                    .build();
            })
            .toList();

        return SeatMapResponse.builder()
            .layoutId(layout.getId())
            .backgroundImageUrl(layout.getBackgroundImageUrl())
            .backgroundWidth(layout.getBackgroundWidth())
            .backgroundHeight(layout.getBackgroundHeight())
            .mapConfig(layout.getMapConfig())
            .sectors(sectorDtos)
            .build();
    }

    private void validatePayload(
        UUID eventId,
        List<SeatMapPublishRequest.SectorPayload> sectorPayloads,
        Map<UUID, EventSector> dbSectorMap,
        Map<UUID, EventSeat> dbSeatMap,
        Map<UUID, TicketType> ticketTypesById,
        Set<UUID> existingPayloadSectorIds,
        Set<UUID> existingPayloadSeatIds
    ) {
        Set<UUID> sectorIds = new HashSet<>();
        Set<UUID> seatIds = new HashSet<>();
        Set<String> seatPositions = new HashSet<>();

        for (SeatMapPublishRequest.SectorPayload sector : sectorPayloads) {
            if (sector.id() == null) {
                throw new InvalidRequestException("Sector id is required");
            }
            if (!sectorIds.add(sector.id())) {
                throw new InvalidRequestException("Duplicate sector id: " + sector.id());
            }
            if (!dbSectorMap.containsKey(sector.id()) && existingPayloadSectorIds.contains(sector.id())) {
                throw new InvalidRequestException("Sector id does not belong to this event: " + sector.id());
            }
            if (isBlank(sector.name())) {
                throw new InvalidRequestException("Sector name is required");
            }

            boolean sectorActive = isSectorActive(sector);
            String sectorType = normalizeSectorType(sector.sectorType());
            List<SeatMapPublishRequest.SeatPayload> seats = sector.seats() != null ? sector.seats() : List.of();
            if (sectorActive && STANDING.equals(sectorType)) {
                validateStandingSectorPayload(eventId, sector, dbSectorMap.get(sector.id()));
                if (seats.stream().anyMatch(this::isSeatActive)) {
                    throw new InvalidRequestException("Standing sectors must not contain active seats");
                }
            }

            for (SeatMapPublishRequest.SeatPayload seat : seats) {
                if (seat.id() == null) {
                    throw new InvalidRequestException("Seat id is required");
                }
                if (!seatIds.add(seat.id())) {
                    throw new InvalidRequestException("Duplicate seat id: " + seat.id());
                }
                EventSeat dbSeat = dbSeatMap.get(seat.id());
                if (dbSeat == null && existingPayloadSeatIds.contains(seat.id())) {
                    throw new InvalidRequestException("Seat id does not belong to this event: " + seat.id());
                }
                if (dbSeat != null && !dbSeat.getSector().getId().equals(sector.id())) {
                    throw new InvalidRequestException("Seat cannot be moved between sectors: " + seat.id());
                }
                if (isBlank(seat.rowName()) || isBlank(seat.seatNumber())) {
                    throw new InvalidRequestException("Seat rowName and seatNumber are required");
                }
                if (seat.coordX() == null || seat.coordY() == null) {
                    throw new InvalidRequestException("Seat coordinates are required");
                }
                String positionKey = sector.id() + "|" + seat.rowName().trim() + "|" + seat.seatNumber().trim();
                if (!seatPositions.add(positionKey)) {
                    throw new InvalidRequestException("Duplicate seat position in sector " + sector.id());
                }
                if (sectorActive && isSeatActive(seat) && SEATED.equals(sectorType)) {
                    validateSeatTicketType(sector.id(), seat.ticketTypeId(), seat.colorCode(), ticketTypesById);
                }
            }
        }
    }

    private void validateSafeMode(
        UUID eventId,
        List<SeatMapPublishRequest.SectorPayload> sectorPayloads,
        List<EventSector> dbSectors,
        List<EventSeat> dbSeats
    ) {
        Map<UUID, SeatMapPublishRequest.SectorPayload> sectorPayloadMap = sectorPayloads.stream()
            .collect(Collectors.toMap(SeatMapPublishRequest.SectorPayload::id, Function.identity()));
        Set<UUID> protectedSeatIds = dbSeats.isEmpty()
            ? Set.of()
            : eventSeatInventoryRepository.findEventSeatIdsByStatusIn(
                dbSeats.stream().map(EventSeat::getId).collect(Collectors.toSet()),
                PROTECTED_STATUSES
            );
        Map<UUID, Set<UUID>> payloadSeatIdsBySector = new HashMap<>();
        for (SeatMapPublishRequest.SectorPayload sector : sectorPayloads) {
            Set<UUID> ids = sector.seats() == null
                ? Set.of()
                : sector.seats().stream().map(SeatMapPublishRequest.SeatPayload::id).collect(Collectors.toSet());
            payloadSeatIdsBySector.put(sector.id(), ids);
        }

        Set<UUID> seatsToDeactivate = new HashSet<>();
        Set<UUID> sectorsToDeactivate = new HashSet<>();
        for (EventSector dbSector : dbSectors) {
            SeatMapPublishRequest.SectorPayload sectorPayload = sectorPayloadMap.get(dbSector.getId());
            if (sectorPayload == null || !isSectorActive(sectorPayload)) {
                sectorsToDeactivate.add(dbSector.getId());
            }
            if (sectorPayload != null) {
                String oldSectorType = normalizeSectorType(dbSector.getSectorType());
                String newSectorType = normalizeSectorType(sectorPayload.sectorType());
                if (!Objects.equals(oldSectorType, newSectorType)
                    && (hasProtectedSeatsInSector(eventId, dbSector.getId())
                        || hasTicketTypesAttachedToSector(eventId, dbSector.getId()))) {
                    throw new InvalidRequestException("Cannot change sector type while seats or ticket types are attached");
                }
            }
        }

        Map<UUID, SeatMapPublishRequest.SectorPayload> sectorById = sectorPayloadMap;
        Map<UUID, SeatMapPublishRequest.SeatPayload> seatPayloadMap = sectorPayloads.stream()
            .flatMap(sector -> (sector.seats() != null ? sector.seats() : List.<SeatMapPublishRequest.SeatPayload>of()).stream())
            .collect(Collectors.toMap(SeatMapPublishRequest.SeatPayload::id, Function.identity()));

        for (EventSeat dbSeat : dbSeats) {
            UUID sectorId = dbSeat.getSector().getId();
            SeatMapPublishRequest.SectorPayload sectorPayload = sectorById.get(sectorId);
            SeatMapPublishRequest.SeatPayload seatPayload = seatPayloadMap.get(dbSeat.getId());
            boolean stillInSector = payloadSeatIdsBySector.getOrDefault(sectorId, Set.of()).contains(dbSeat.getId());
            boolean seatWillRemainActive = sectorPayload != null
                && isSectorActive(sectorPayload)
                && stillInSector
                && seatPayload != null
                && isSeatActive(seatPayload);
            if (!seatWillRemainActive) {
                seatsToDeactivate.add(dbSeat.getId());
            } else if (protectedSeatIds.contains(dbSeat.getId())
                && hasProtectedSeatMutation(dbSeat, sectorPayload, seatPayload)) {
                throw new InvalidRequestException("Cannot change reserved or sold seat details");
            }
        }

        if (!seatsToDeactivate.isEmpty()
            && eventSeatInventoryRepository.countByEventSeatIdInAndStatusIn(seatsToDeactivate, PROTECTED_STATUSES) > 0) {
            throw new InvalidRequestException("Cannot hide or delete seats that are reserved or sold");
        }
        for (UUID sectorId : sectorsToDeactivate) {
            if (hasProtectedSeatsInSector(eventId, sectorId)
                || hasCommittedTicketsInSector(eventId, sectorId)
                || hasVisibleTicketTypesInSector(eventId, sectorId)) {
                throw new InvalidRequestException("Cannot hide or delete sectors that contain active ticket types or sold/reserved tickets");
            }
        }
    }

    private void validateStandingSectorPayload(
        UUID eventId,
        SeatMapPublishRequest.SectorPayload sector,
        EventSector dbSector
    ) {
        int capacity = resolveSectorCapacity(sector, dbSector, STANDING, isSectorActive(sector));
        if (capacity < committedTicketsInSector(eventId, sector.id())) {
            throw new InvalidRequestException("Standing capacity is lower than sold or reserved tickets");
        }
        long configured = ticketTypeRepository.findByEventIdAndEventSectorIdAndIsDeletedFalse(eventId, sector.id()).stream()
            .filter(tt -> tt.getStatus() != TicketType.TicketStatus.HIDDEN)
            .mapToLong(tt -> safe(tt.getQuantityTotal()))
            .sum();
        if (configured > capacity) {
            throw new InvalidRequestException("Total ticket quantity exceeds standing sector capacity");
        }
    }

    private void validateSeatTicketType(
        UUID sectorId,
        UUID ticketTypeId,
        String seatPayloadColor,
        Map<UUID, TicketType> ticketTypesById
    ) {
        if (ticketTypeId == null) {
            throw new InvalidRequestException("Active seated seats must have ticketTypeId");
        }
        TicketType ticketType = ticketTypesById.get(ticketTypeId);
        if (ticketType == null || ticketType.getStatus() == TicketType.TicketStatus.HIDDEN) {
            throw new InvalidRequestException("ticketTypeId does not belong to this event: " + ticketTypeId);
        }
        if (!sectorId.equals(ticketType.getEventSectorId())) {
            throw new InvalidRequestException("ticketTypeId does not belong to this sector: " + ticketTypeId);
        }
        if (ticketType.getInventoryMode() != InventoryMode.ASSIGNED_SEAT) {
            throw new InvalidRequestException("Seated seats must be assigned to ASSIGNED_SEAT ticket types");
        }
        String ticketTypeColor = normalizeColorCode(ticketType.getColorCode(), "ticketType.colorCode");
        if (ticketTypeColor == null) {
            throw new InvalidRequestException("ASSIGNED_SEAT ticket types must have colorCode before seats can be assigned");
        }
        String payloadColor = normalizeColorCode(seatPayloadColor, "seat.colorCode");
        if (payloadColor != null && !Objects.equals(payloadColor, ticketTypeColor)) {
            throw new InvalidRequestException("Seat colorCode must match assigned TicketType colorCode");
        }
    }

    private void syncAssignedSeatTicketCounters(UUID eventId) {
        List<TicketType> assignedSeatTypes = ticketTypeRepository.findByEventIdAndIsDeletedFalse(eventId).stream()
            .filter(tt -> tt.getInventoryMode() == InventoryMode.ASSIGNED_SEAT)
            .toList();
        for (TicketType tt : assignedSeatTypes) {
            int oldTotal = safe(tt.getQuantityTotal());
            long activeSeats = eventSeatRepository.countByTicketTypeIdAndIsActiveTrue(tt.getId());
            long sold = eventSeatInventoryRepository.countByTicketTypeIdAndStatus(tt.getId(), "SOLD");
            long reserved = eventSeatInventoryRepository.countByTicketTypeIdAndStatus(tt.getId(), "RESERVED");
            long committed = sold + reserved;
            if (activeSeats < committed) {
                throw new InvalidRequestException(
                    "Assigned-seat ticket has fewer active seats than sold/reserved seats: " + tt.getId());
            }
            tt.setQuantityTotal(Math.toIntExact(activeSeats));
            tt.setQuantityReserved(Math.toIntExact(reserved));
            tt.setQuantityAvailable(Math.toIntExact(activeSeats - committed));
            syncTicketTypeStatusFromAvailability(tt);
            ticketTypeRepository.save(tt);
            int delta = safe(tt.getQuantityTotal()) - oldTotal;
            if (delta != 0) {
                eventRepository.adjustTotalCapacity(eventId, delta);
            }
        }
    }

    private Map<UUID, String> readSeatStatus(UUID eventId, boolean includeInactive, Collection<UUID> seatedSectorIds) {
        if (!includeInactive) { // Nếu là public view thì đọc cache trước. Nếu cache có dữ liệu thì trả luôn, không cần query DB.
            try {
                Set<UUID> expectedSeatIds = activeSeatIds(seatedSectorIds);
                RMapCache<UUID, String> cache = redissonClient.getMapCache("seat_status:" + eventId);
                Map<UUID, String> cached = cache.readAllMap();
                if (!cached.isEmpty() && cached.keySet().containsAll(expectedSeatIds)) {
                    return cached;
                }
            } catch (RuntimeException ex) {
                log.warn("Failed to read seat status cache for event {}: {}", eventId, ex.getMessage());
            }
        }


        Map<UUID, String> statuses = eventSeatInventoryRepository.findByEventId(eventId).stream() // trả về đủ loại avtive, inactive, ghế cũ cho  organizer, not public view
            .collect(Collectors.toMap(
                inv -> inv.getEventSeat().getId(),
                EventSeatInventory::getStatus,
                (left, right) -> left
            ));

        if (!includeInactive) { // Nếu là public view mà vừa phải fallback xuống đoc DB, thì rebuild cache để lần sau đọc nhanh hơn.
            warmSeatStatusCache(eventId, seatedSectorIds);
        }
        return statuses;
    }

    private Set<UUID> activeSeatIds(Collection<UUID> seatedSectorIds) {
        if (seatedSectorIds == null || seatedSectorIds.isEmpty()) {
            return Set.of();
        }
        return eventSeatRepository.findAllBySectorIdIn(seatedSectorIds).stream()
            .filter(seat -> Boolean.TRUE.equals(seat.getIsActive()))
            .map(EventSeat::getId)
            .collect(Collectors.toSet());
    }

    private String resolveInventoryStatus(Map<UUID, String> inventoryStatusMap, UUID seatId, boolean includeInactive) {
        String status = inventoryStatusMap.get(seatId);
        if (status != null) {
            return status;
        }
        return includeInactive ? "AVAILABLE" : "BLOCKED";
    }

    private Optional<Event> resolveEvent(String idOrSlug) {
        try {
            return eventRepository.findByIdAndIsDeletedFalse(UUID.fromString(idOrSlug));
        } catch (IllegalArgumentException ignored) {
            return eventRepository.findBySlugAndIsDeletedFalse(idOrSlug);
        }
    }

    private void updateLayout(EventLayout layout, SeatMapPublishRequest payload) {
        if (payload.name() != null) layout.setName(payload.name());
        if (payload.backgroundImageUrl() != null) layout.setBackgroundImageUrl(payload.backgroundImageUrl());
        if (payload.backgroundPublicId() != null) layout.setBackgroundPublicId(payload.backgroundPublicId());
        if (payload.backgroundWidth() != null) layout.setBackgroundWidth(payload.backgroundWidth());
        if (payload.backgroundHeight() != null) layout.setBackgroundHeight(payload.backgroundHeight());
        if (payload.mapConfig() != null) layout.setMapConfig(payload.mapConfig());
    }

    private int resolveSectorCapacity(
        SeatMapPublishRequest.SectorPayload sectorPayload,
        EventSector existingSector,
        String sectorType,
        boolean active
    ) {
        if (!active) {
            return 0;
        }
        if (STANDING.equals(sectorType)) {
            Integer capacity = sectorPayload.totalCapacity() != null
                ? sectorPayload.totalCapacity()
                : existingSector != null ? existingSector.getTotalCapacity() : null;
            if (capacity == null || capacity < 1) {
                throw new InvalidRequestException("Standing sector totalCapacity must be >= 1");
            }
            return capacity;
        }
        List<SeatMapPublishRequest.SeatPayload> seats =
            sectorPayload.seats() != null ? sectorPayload.seats() : List.of();
        return (int) seats.stream().filter(this::isSeatActive).count();
    }

    private boolean hasProtectedSeatsInSector(UUID eventId, UUID sectorId) {
        return eventSeatInventoryRepository.countByEventIdAndSectorIdAndStatusIn(
            eventId, sectorId, PROTECTED_STATUSES) > 0;
    }

    private boolean hasTicketTypesAttachedToSector(UUID eventId, UUID sectorId) {
        return !ticketTypeRepository.findByEventIdAndEventSectorIdAndIsDeletedFalse(eventId, sectorId).isEmpty();
    }

    private boolean hasVisibleTicketTypesInSector(UUID eventId, UUID sectorId) {
        return ticketTypeRepository.findByEventIdAndEventSectorIdAndIsDeletedFalse(eventId, sectorId).stream()
            .anyMatch(tt -> tt.getStatus() != TicketType.TicketStatus.HIDDEN
                || Boolean.TRUE.equals(tt.getIsVisible()));
    }

    private boolean hasCommittedTicketsInSector(UUID eventId, UUID sectorId) {
        return committedTicketsInSector(eventId, sectorId) > 0;
    }

    private int committedTicketsInSector(UUID eventId, UUID sectorId) {
        return ticketTypeRepository.findByEventIdAndEventSectorIdAndIsDeletedFalse(eventId, sectorId).stream()
            .mapToInt(tt -> soldCount(tt) + safe(tt.getQuantityReserved()))
            .sum();
    }

    private int soldCount(TicketType ticketType) {
        return safe(ticketType.getQuantityTotal())
            - safe(ticketType.getQuantityAvailable())
            - safe(ticketType.getQuantityReserved());
    }

    private boolean hasProtectedSeatMutation(
        EventSeat dbSeat,
        SeatMapPublishRequest.SectorPayload sectorPayload,
        SeatMapPublishRequest.SeatPayload seatPayload
    ) {
        String sectorType = normalizeSectorType(sectorPayload.sectorType());
        UUID payloadTicketTypeId = SEATED.equals(sectorType) ? seatPayload.ticketTypeId() : null;
        return !textEquals(dbSeat.getRowName(), seatPayload.rowName())
            || !textEquals(dbSeat.getSeatNumber(), seatPayload.seatNumber())
            || !textEquals(dbSeat.getSeatLabel(), seatPayload.seatLabel())
            || !numberEquals(dbSeat.getCoordX(), seatPayload.coordX())
            || !numberEquals(dbSeat.getCoordY(), seatPayload.coordY())
            || !textEquals(
                defaultIfBlank(dbSeat.getSeatType(), DEFAULT_SEAT_TYPE),
                defaultIfBlank(seatPayload.seatType(), DEFAULT_SEAT_TYPE)
            )
            || !Objects.equals(dbSeat.getTicketTypeId(), payloadTicketTypeId);
    }

    private void syncTicketTypeStatusFromAvailability(TicketType ticketType) {
        if (ticketType.getStatus() == TicketType.TicketStatus.HIDDEN) {
            return;
        }
        if (safe(ticketType.getQuantityAvailable()) > 0
            && ticketType.getStatus() == TicketType.TicketStatus.SOLD_OUT) {
            ticketType.setStatus(TicketType.TicketStatus.ACTIVE);
        } else if (safe(ticketType.getQuantityAvailable()) == 0
            && ticketType.getStatus() == TicketType.TicketStatus.ACTIVE) {
            ticketType.setStatus(TicketType.TicketStatus.SOLD_OUT);
        }
    }

    private boolean isSectorActive(SeatMapPublishRequest.SectorPayload sector) {
        return sector.visible() == null || Boolean.TRUE.equals(sector.visible());
    }

    private boolean isSeatActive(SeatMapPublishRequest.SeatPayload seat) {
        return seat.isActive() == null || Boolean.TRUE.equals(seat.isActive());
    }

    private Set<UUID> collectSectorIds(List<SeatMapPublishRequest.SectorPayload> sectorPayloads) {
        return sectorPayloads.stream()
            .map(SeatMapPublishRequest.SectorPayload::id)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
    }

    private Set<UUID> collectSeatIds(List<SeatMapPublishRequest.SectorPayload> sectorPayloads) {
        return sectorPayloads.stream()
            .flatMap(sector -> (sector.seats() != null ? sector.seats() : List.<SeatMapPublishRequest.SeatPayload>of()).stream())
            .map(SeatMapPublishRequest.SeatPayload::id)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());
    }

    private Map<String, Object> buildSectorMapData(
        SeatMapPublishRequest.SectorPayload sector,
        boolean active,
        boolean deleted
    ) {
        Map<String, Object> mapData = copyMap(sector.mapData());
        mapData.remove("ticketTypeId");
        mapData.remove("ticketTypeName");
        if (sector.code() != null) {
            mapData.put("code", sector.code());
        }
        mapData.put("visible", active);
        if (deleted) {
            mapData.put("deleted", true);
        }
        return mapData;
    }

    private Map<String, Object> markSectorInactive(Map<String, Object> source, boolean deleted) {
        Map<String, Object> mapData = copyMap(source);
        mapData.put("visible", false);
        if (deleted) {
            mapData.put("deleted", true);
        }
        return mapData;
    }

    private Map<String, Object> buildSeatMapData(
        SeatMapPublishRequest.SeatPayload seat,
        boolean active,
        boolean deleted
    ) {
        Map<String, Object> mapData = copyMap(seat.coordMetadata());
        mapData.put("hidden", !active);
        if (deleted) {
            mapData.put("deleted", true);
        }
        return mapData;
    }

    private Map<String, Object> markSeatInactive(Map<String, Object> source, boolean deleted) {
        Map<String, Object> mapData = copyMap(source);
        mapData.put("hidden", true);
        if (deleted) {
            mapData.put("deleted", true);
        }
        return mapData;
    }

    private void warmSeatStatusCache(UUID eventId, Collection<UUID> seatedSectorIds) {
        try {
            RMapCache<UUID, String> cache = redissonClient.getMapCache("seat_status:" + eventId);
            if (seatedSectorIds == null || seatedSectorIds.isEmpty()) {
                cache.clear();
                return;
            }
            List<EventSeat> activeSeats = eventSeatRepository.findAllBySectorIdIn(seatedSectorIds).stream()
                .filter(seat -> Boolean.TRUE.equals(seat.getIsActive()))
                .toList();
            Map<UUID, String> inventoryStatusMap = eventSeatInventoryRepository.findByEventId(eventId).stream() // Tất cả inventory status lấy từ DB cho event. Nó có thể chứa: Ghế inactive,  Ghế cũ/legacy.
                    .collect(Collectors.toMap(
                    inv -> inv.getEventSeat().getId(),
                    EventSeatInventory::getStatus,
                    (left, right) -> left
                ));
            Map<UUID, String> cacheValues = activeSeats.stream()
                .filter(seat -> inventoryStatusMap.containsKey(seat.getId()))
                .collect(Collectors.toMap(
                    EventSeat::getId,
                    seat -> inventoryStatusMap.get(seat.getId())
                ));
            cache.clear();
            cache.putAll(cacheValues);
            cache.expire(Duration.ofHours(48));
        } catch (RuntimeException ex) {
            log.warn("Failed to warm seat status cache for event {}: {}", eventId, ex.getMessage());
        }
    }

    private void publishSeatStatusSnapshot(UUID eventId, Collection<UUID> seatedSectorIds) {
        if (seatedSectorIds == null || seatedSectorIds.isEmpty()) {
            eventPublisher.publishEvent(new SeatStatusChangedEvent(eventId, Map.of(), true));
            return;
        }
        Set<UUID> activeSeats = activeSeatIds(seatedSectorIds);
        Map<UUID, String> inventoryStatusMap = eventSeatInventoryRepository.findByEventId(eventId).stream()
            .filter(inv -> activeSeats.contains(inv.getEventSeat().getId()))
            .collect(Collectors.toMap(
                inv -> inv.getEventSeat().getId(),
                EventSeatInventory::getStatus,
                (left, right) -> left
            ));
        eventPublisher.publishEvent(new SeatStatusChangedEvent(eventId, inventoryStatusMap, true));
    }

    private void clearSeatStatusCache(UUID eventId) {
        try {
            RMapCache<UUID, String> cache = redissonClient.getMapCache("seat_status:" + eventId);
            cache.clear();
        } catch (RuntimeException ex) {
            log.warn("Failed to clear seat status cache for event {}: {}", eventId, ex.getMessage());
        }
    }

    private String normalizeSectorType(String value) {
        String sectorType = defaultIfBlank(value, DEFAULT_SECTOR_TYPE).toUpperCase();
        if (!SEATED.equals(sectorType) && !STANDING.equals(sectorType)) {
            throw new InvalidRequestException("Sector type " + sectorType + " is not supported in MVP");
        }
        return sectorType;
    }

    private String resolveSeatColorSnapshot(TicketType ticketType, boolean active) {
        return active ? resolveSeatColor(ticketType) : null;
    }

    private String resolveSeatColor(TicketType ticketType) {
        return ticketType != null ? trimToNull(ticketType.getColorCode()) : null;
    }

    private Map<String, Object> copyMap(Map<String, Object> source) {
        return source == null ? new LinkedHashMap<>() : new LinkedHashMap<>(source);
    }

    private String defaultIfBlank(String value, String fallback) {
        return isBlank(value) ? fallback : value.trim();
    }

    private String trimToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private String normalizeColorCode(String value, String fieldName) {
        String normalized = trimToNull(value);
        if (normalized == null) {
            return null;
        }
        if (!normalized.matches("^#[0-9A-Fa-f]{6}$")) {
            throw new InvalidRequestException(fieldName + " must use #RRGGBB format");
        }
        return normalized.toUpperCase();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private boolean textEquals(String left, String right) {
        return Objects.equals(trimToNull(left), trimToNull(right));
    }

    private boolean numberEquals(BigDecimal left, BigDecimal right) {
        if (left == null || right == null) {
            return left == right;
        }
        return left.compareTo(right) == 0;
    }

    private int safe(Integer value) {
        return value != null ? value : 0;
    }
}
