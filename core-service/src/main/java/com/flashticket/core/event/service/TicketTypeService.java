package com.flashticket.core.event.service;

import com.flashticket.core.common.exception.InvalidRequestException;
import com.flashticket.core.common.exception.ResourceNotFoundException;
import com.flashticket.core.event.dto.CreateTicketTypeRequest;
import com.flashticket.core.event.dto.TicketTypeOrganizerDTO;
import com.flashticket.core.event.entity.Event;
import com.flashticket.core.event.entity.EventSector;
import com.flashticket.core.event.entity.TicketType;
import com.flashticket.core.event.entity.TicketType.AccessScope;
import com.flashticket.core.event.entity.TicketType.InventoryMode;
import com.flashticket.core.event.repository.EventRepository;
import com.flashticket.core.event.repository.EventSeatInventoryRepository;
import com.flashticket.core.event.repository.EventSeatRepository;
import com.flashticket.core.event.repository.EventSectorRepository;
import com.flashticket.core.event.repository.TicketTypeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class TicketTypeService {

    private final TicketTypeRepository ticketTypeRepository;
    private final EventRepository eventRepository;
    private final EventSectorRepository eventSectorRepository;
    private final EventSeatRepository eventSeatRepository;
    private final EventSeatInventoryRepository eventSeatInventoryRepository;
    private final CompatibilityPolicy compatibilityPolicy;

    @Transactional(readOnly = true)
    public List<TicketTypeOrganizerDTO> getTicketTypes(UUID eventId, String organizerId) {
        findOwnedEvent(eventId, organizerId); // check quyền sở hữu, không phải để lấy data dùng tiếp
        return ticketTypeRepository.findByEventIdAndIsDeletedFalse(eventId)
            .stream()
            .map(TicketTypeOrganizerDTO::from)
            .toList();
    }

    @Transactional
    public TicketTypeOrganizerDTO createTicketType(UUID eventId, CreateTicketTypeRequest req, String organizerId) {
        Event event = findOwnedEvent(eventId, organizerId);

        if (event.getStatus() == Event.EventStatus.COMPLETED
            || event.getStatus() == Event.EventStatus.CANCELLED) {
            throw new InvalidRequestException("Cannot add ticket type to a completed or cancelled event");
        }
        validateSaleWindow(req.saleStartDatetime(), req.saleEndDatetime());

        EventSector sector = findSectorIfProvided(eventId, req.eventSectorId());
        CompatibilityPolicy.Compatibility derived = compatibilityPolicy.derive(
            req.eventSectorId(), sector != null ? sector.getSectorType() : null); // trả về accessScope, inventoryMode, sectorType

        compatibilityPolicy.validate(derived.accessScope(), derived.sectorType(), derived.inventoryMode());

        int quantityTotal = resolveCreateQuantity(req, derived);
        if (derived.inventoryMode() == InventoryMode.QUANTITY
            && derived.accessScope() == AccessScope.SECTOR) {
            validateStandingSectorCapacity(eventId, sector, null, quantityTotal); // tổng quantity của các ticketType phải <= tổng capacity của sector
        }

        String colorCode = normalizeColorCode(req.colorCode(), "ticketType.colorCode");
        validateAssignedSeatColor(derived.inventoryMode(), colorCode);

        TicketType tt = TicketType.builder()
            .event(event)
            .eventSectorId(req.eventSectorId())
            .inventoryMode(derived.inventoryMode())
            .accessScope(derived.accessScope())
            .name(req.name())
            .description(req.description())
            .price(req.price())
            .originalPrice(req.originalPrice())
            .quantityTotal(quantityTotal)
            .quantityAvailable(quantityTotal)
            .quantityReserved(0)
            .maxPerOrder(req.maxPerOrder() != null ? req.maxPerOrder() : 10)
            .seatSelectionEnabled(derived.inventoryMode() == InventoryMode.ASSIGNED_SEAT)
            .colorCode(colorCode)
            .displayOrder(req.displayOrder() != null ? req.displayOrder() : 0)
            .status(TicketType.TicketStatus.ACTIVE)
            .isVisible(req.isVisible() != null ? req.isVisible() : true)
            .isDeleted(false)
            .saleStartDatetime(req.saleStartDatetime())
            .saleEndDatetime(req.saleEndDatetime())
            .build();

        tt = ticketTypeRepository.save(tt);
        if (derived.inventoryMode() == InventoryMode.ASSIGNED_SEAT) { // Chỉ ASSIGNED_SEAT cần sync lại ở đây vì số lượng của nó không lấy từ request, mà lấy từ ghế thật. QUANTITY  được set ngay lúc build rồi
            syncAssignedSeatCounters(tt); // Tính lại số vé total, reserved, available sau khi tạo ticketType mới
            syncTicketTypeStatusFromAvailability(tt); // Sync status dựa trên số vé available (nếu hết vé -> SOLD_OUT, nếu còn -> ACTIVE)
            // vé mới tạo thì status luôn là active, nhưng vẫn cần check vì trường hợp tạo vé nhưng chưa tạo ghế => quantity = 0 => phải để là SOLD OUT, còn QUANTITY thì khi mới create có quantity > 1 và set ACTIVE sẵn rồi
            tt = ticketTypeRepository.save(tt);
        }

        eventRepository.adjustTotalCapacity(eventId, safe(tt.getQuantityTotal()));

        log.info("Created ticket type '{}' (mode={}, qty={}) for event {}",
            tt.getName(), tt.getInventoryMode(), tt.getQuantityTotal(), eventId);
        return TicketTypeOrganizerDTO.from(tt);
    }

    @Transactional
    public TicketTypeOrganizerDTO updateTicketType(UUID eventId, UUID typeId, CreateTicketTypeRequest req, String organizerId) {
        findOwnedEvent(eventId, organizerId);

        TicketType tt = ticketTypeRepository.findByIdAndEventIdAndIsDeletedFalse(typeId, eventId)
            .orElseThrow(() -> new ResourceNotFoundException("Ticket type not found: " + typeId));

        Instant saleStart = req.saleStartDatetime() != null ? req.saleStartDatetime() : tt.getSaleStartDatetime();
        Instant saleEnd = req.saleEndDatetime() != null ? req.saleEndDatetime() : tt.getSaleEndDatetime();
        validateSaleWindow(saleStart, saleEnd);

        UUID targetSectorId = req.eventSectorId() != null ? req.eventSectorId() : tt.getEventSectorId();
        EventSector sector = findSectorIfProvided(eventId, targetSectorId);
        CompatibilityPolicy.Compatibility derived = compatibilityPolicy.derive(
            targetSectorId, sector != null ? sector.getSectorType() : null);
        compatibilityPolicy.validate(derived.accessScope(), derived.sectorType(), derived.inventoryMode());

        if (isInventoryConfigurationChanged(tt, targetSectorId, derived)
            && hasTicketTypeUsageOrSeatAssignments(tt)) {
            throw new InvalidRequestException("Cannot change ticket type sector or inventory mode after seats/orders exist");
        }

        int oldTotal = safe(tt.getQuantityTotal());
        String oldColorCode = tt.getColorCode();

        if (req.name() != null) tt.setName(req.name());
        if (req.description() != null) tt.setDescription(req.description());
        if (req.price() != null) tt.setPrice(req.price());
        if (req.originalPrice() != null) tt.setOriginalPrice(req.originalPrice());
        if (req.maxPerOrder() != null) tt.setMaxPerOrder(req.maxPerOrder());
        if (req.colorCode() != null) tt.setColorCode(normalizeColorCode(req.colorCode(), "ticketType.colorCode"));
        if (req.displayOrder() != null) tt.setDisplayOrder(req.displayOrder());
        if (req.isVisible() != null) tt.setIsVisible(req.isVisible());
        if (req.saleStartDatetime() != null) tt.setSaleStartDatetime(req.saleStartDatetime());
        if (req.saleEndDatetime() != null) tt.setSaleEndDatetime(req.saleEndDatetime());

        tt.setEventSectorId(targetSectorId);
        tt.setInventoryMode(derived.inventoryMode());
        tt.setAccessScope(derived.accessScope());
        tt.setSeatSelectionEnabled(derived.inventoryMode() == InventoryMode.ASSIGNED_SEAT);
        tt.setColorCode(normalizeColorCode(tt.getColorCode(), "ticketType.colorCode"));
        validateAssignedSeatColor(derived.inventoryMode(), tt.getColorCode());

        if (derived.inventoryMode() == InventoryMode.ASSIGNED_SEAT) {
            syncAssignedSeatCounters(tt);
        } else {
            int quantityTotal = req.quantityTotal() != null ? req.quantityTotal() : oldTotal;
            validateQuantityTotal(quantityTotal);
            validateQuantityCanCoverExistingReservations(typeId, quantityTotal, safe(tt.getQuantityReserved()));
            if (derived.accessScope() == AccessScope.SECTOR) {
                validateStandingSectorCapacity(eventId, sector, typeId, quantityTotal);
            }
            int sold = soldCount(typeId);
            int reserved = safe(tt.getQuantityReserved());
            tt.setQuantityTotal(quantityTotal);
            tt.setQuantityAvailable(quantityTotal - sold - reserved);
        }
        syncTicketTypeStatusFromAvailability(tt);

        tt = ticketTypeRepository.save(tt);
        if (!Objects.equals(oldColorCode, tt.getColorCode())) {
            eventSeatRepository.updateColorCodeByTicketTypeId(tt.getId(), tt.getColorCode());
        }
        int delta = safe(tt.getQuantityTotal()) - oldTotal;
        if (delta != 0) {
            eventRepository.adjustTotalCapacity(eventId, delta);
        }

        log.info("Updated ticket type {}", typeId);
        return TicketTypeOrganizerDTO.from(tt);
    }

    @Transactional
    public void deleteTicketType(UUID eventId, UUID typeId, String organizerId) {
        findOwnedEvent(eventId, organizerId);

        TicketType tt = ticketTypeRepository.findByIdAndEventIdAndIsDeletedFalse(typeId, eventId)
            .orElseThrow(() -> new ResourceNotFoundException("Ticket type not found: " + typeId));

        Integer sold = ticketTypeRepository.countSoldTickets(typeId);
        if (sold != null && sold > 0) {
            throw new InvalidRequestException("Cannot delete a ticket type that has sold tickets");
        }
        if (safe(tt.getQuantityReserved()) > 0) {
            throw new InvalidRequestException("Cannot delete a ticket type that has reserved tickets");
        }
        if (eventSeatRepository.existsActiveByTicketTypeId(typeId)) {
            throw new InvalidRequestException("Cannot delete a ticket type that is assigned to active seats");
        }

        eventRepository.adjustTotalCapacity(eventId, -safe(tt.getQuantityTotal()));
        tt.setIsDeleted(true);
        tt.setStatus(TicketType.TicketStatus.HIDDEN);
        ticketTypeRepository.save(tt);

        log.info("Soft deleted ticket type {} from event {}", typeId, eventId);
    }

    private Event findOwnedEvent(UUID eventId, String organizerId) {
        return eventRepository.findByIdAndOrganizerIdAndIsDeletedFalse(eventId, organizerId)
            .orElseThrow(() -> new ResourceNotFoundException("Event not found: " + eventId));
    }

    private EventSector findSectorIfProvided(UUID eventId, UUID eventSectorId) {
        if (eventSectorId == null) {
            return null;
        }
        EventSector sector = eventSectorRepository.findById(eventSectorId)
            .orElseThrow(() -> new ResourceNotFoundException("Sector not found: " + eventSectorId));
        if (!sector.getLayout().getEvent().getId().equals(eventId)) {
            throw new InvalidRequestException("Sector does not belong to this event");
        }
        return sector;
    }

    private int resolveCreateQuantity(CreateTicketTypeRequest req, CompatibilityPolicy.Compatibility derived) {
        if (derived.inventoryMode() == InventoryMode.ASSIGNED_SEAT) {
            return 0;
        }
        validateQuantityTotal(req.quantityTotal());
        return req.quantityTotal();
    }

    private void syncAssignedSeatCounters(TicketType tt) {
        long activeSeats = eventSeatRepository.countByTicketTypeIdAndIsActiveTrue(tt.getId()); // Đếm số ghế active đang gán ticketTypeId = tt.id
        long sold = eventSeatInventoryRepository.countByTicketTypeIdAndStatus(tt.getId(), "SOLD"); // Đếm số ghế/ticket đã SOLD.
        long reserved = eventSeatInventoryRepository.countByTicketTypeIdAndStatus(tt.getId(), "RESERVED"); // Đếm số ghế/ticket đã RESERVED.
        long committed = sold + reserved;
        if (activeSeats < committed) {
            throw new InvalidRequestException(
                "Assigned-seat ticket has fewer active seats than sold/reserved seats");
        }
        tt.setQuantityTotal(Math.toIntExact(activeSeats)); // Tổng số ghế active = số vé sẽ có
        tt.setQuantityReserved(Math.toIntExact(reserved)); // Số vé đã reserved
        tt.setQuantityAvailable(Math.toIntExact(activeSeats - committed)); // Số vé có thể bán = tổng số vé - reserved
    }

    private boolean isInventoryConfigurationChanged(
        TicketType ticketType,
        UUID targetSectorId,
        CompatibilityPolicy.Compatibility derived
    ) {
        return !Objects.equals(ticketType.getEventSectorId(), targetSectorId)
            || ticketType.getInventoryMode() != derived.inventoryMode()
            || ticketType.getAccessScope() != derived.accessScope();
    }

    private boolean hasTicketTypeUsageOrSeatAssignments(TicketType ticketType) {
        return soldCount(ticketType.getId()) > 0
            || safe(ticketType.getQuantityReserved()) > 0
            || eventSeatRepository.existsActiveByTicketTypeId(ticketType.getId());
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

    private void validateQuantityTotal(Integer quantityTotal) {
        if (quantityTotal == null || quantityTotal < 1) {
            throw new InvalidRequestException("Quantity ticket requires quantityTotal >= 1");
        }
    }

    private void validateQuantityCanCoverExistingReservations(UUID ticketTypeId, int quantityTotal, int reserved) {
        int sold = soldCount(ticketTypeId);
        if (quantityTotal < sold + reserved) {
            throw new InvalidRequestException(
                "Quantity cannot be lower than sold plus reserved tickets");
        }
    }

    private void validateStandingSectorCapacity(
        UUID eventId,
        EventSector sector,
        UUID currentTicketTypeId,
        int requestedQuantity
    ) {
        if (sector == null) {
            throw new InvalidRequestException("Sector is required for sector-level ticket");
        }
        int capacity = safe(sector.getTotalCapacity());
        long existing = ticketTypeRepository.findByEventIdAndEventSectorIdAndIsDeletedFalse(eventId, sector.getId()).stream()
            .filter(tt -> currentTicketTypeId == null || !currentTicketTypeId.equals(tt.getId()))
            .filter(tt -> tt.getStatus() != TicketType.TicketStatus.HIDDEN)
            .mapToLong(tt -> safe(tt.getQuantityTotal()))
            .sum();
        long total = existing + requestedQuantity;
        if (total > capacity) {
            throw new InvalidRequestException(
                "Total ticket quantity exceeds standing sector capacity");
        }
    }

    private void validateSaleWindow(Instant saleStart, Instant saleEnd) {
        if (saleStart != null && saleEnd != null && !saleEnd.isAfter(saleStart)) {
            throw new InvalidRequestException("Sale end datetime must be after sale start datetime");
        }
    }

    private void validateAssignedSeatColor(InventoryMode inventoryMode, String colorCode) {
        if (inventoryMode == InventoryMode.ASSIGNED_SEAT && colorCode == null) {
            throw new InvalidRequestException("ASSIGNED_SEAT ticket types require colorCode");
        }
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

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private int soldCount(UUID ticketTypeId) {
        Integer sold = ticketTypeRepository.countSoldTickets(ticketTypeId);
        return sold != null ? sold : 0;
    }

    private int safe(Integer value) {
        return value != null ? value : 0;
    }
}
