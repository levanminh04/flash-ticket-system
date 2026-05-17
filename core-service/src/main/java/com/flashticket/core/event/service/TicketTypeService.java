package com.flashticket.core.event.service;

import com.flashticket.core.common.exception.InvalidRequestException;
import com.flashticket.core.common.exception.ResourceNotFoundException;
import com.flashticket.core.event.dto.CreateTicketTypeRequest;
import com.flashticket.core.event.dto.TicketTypeOrganizerDTO;
import com.flashticket.core.event.entity.Event;
import com.flashticket.core.event.entity.TicketType;
import com.flashticket.core.event.repository.EventRepository;
import com.flashticket.core.event.repository.EventSectorRepository;
import com.flashticket.core.event.repository.TicketTypeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Xử lý nghiệp vụ
 *
 * Mỗi thao tác write đều:
 * 1. Verify event thuộc Organizer (IDOR)
 * 2. Validate business rules (status, sold count, capacity)
 * 3. Dùng Atomic Update cho totalCapacity (tránh Lost Update)
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TicketTypeService {

    private final TicketTypeRepository ticketTypeRepository;
    private final EventRepository eventRepository;
    private final EventSectorRepository eventSectorRepository;

    // ═══════════════════════════════════════════════════════
    // READ danh sách loại vé của sự kiện
    // ═══════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public List<TicketTypeOrganizerDTO> getTicketTypes(UUID eventId, String organizerId) {
        findOwnedEvent(eventId, organizerId); // IDOR check
        return ticketTypeRepository.findByEventIdAndIsDeletedFalse(eventId)
            .stream()
            .map(TicketTypeOrganizerDTO::from)
            .toList();
    }

    // ═══════════════════════════════════════════════════════
    // CREATE
    // ═══════════════════════════════════════════════════════

    @Transactional
    public TicketTypeOrganizerDTO createTicketType(UUID eventId, CreateTicketTypeRequest req, String organizerId) {
        Event event = findOwnedEvent(eventId, organizerId);

        // Chặn tạo vé cho event đã completed/cancelled
        if (event.getStatus() == Event.EventStatus.COMPLETED
            || event.getStatus() == Event.EventStatus.CANCELLED) {
            throw new InvalidRequestException("Không thể thêm loại vé cho sự kiện đã kết thúc hoặc bị hủy");
        }

        // Validate sale dates nếu có
        if (req.saleStartDatetime() != null && req.saleEndDatetime() != null
            && !req.saleEndDatetime().isAfter(req.saleStartDatetime())) {
            throw new InvalidRequestException("Ngày kết thúc bán vé phải sau ngày bắt đầu bán vé");
        }

        validateEventSectorScope(eventId, req.eventSectorId());

        TicketType tt = TicketType.builder()
            .event(event)
            .name(req.name())
            .description(req.description())
            .price(req.price())
            .originalPrice(req.originalPrice())
            .quantityTotal(req.quantityTotal())
            .quantityAvailable(req.quantityTotal()) // Ban đầu available = total
            .quantityReserved(0)
            .maxPerOrder(req.maxPerOrder() != null ? req.maxPerOrder() : 10)
            .seatSelectionEnabled(req.seatSelectionEnabled() != null ? req.seatSelectionEnabled() : false)
            .colorCode(req.colorCode())
            .displayOrder(req.displayOrder() != null ? req.displayOrder() : 0)
            .eventSectorId(req.eventSectorId())
            .status(TicketType.TicketStatus.ACTIVE)
            .isVisible(req.isVisible() != null ? req.isVisible() : true)
            .isDeleted(false)
            .saleStartDatetime(req.saleStartDatetime())
            .saleEndDatetime(req.saleEndDatetime())
            .build();

        tt = ticketTypeRepository.save(tt);

        // Atomic update totalCapacity trên Event - tránh lỗi "trí nhớ cũ" (Read-Modify-Write)
        eventRepository.adjustTotalCapacity(eventId, req.quantityTotal());

        log.info("Created ticket type '{}' (qty={}) for event {}", tt.getName(), tt.getQuantityTotal(), eventId);
        return TicketTypeOrganizerDTO.from(tt);
    }

    // ═══════════════════════════════════════════════════════
    // UPDATE
    // ═══════════════════════════════════════════════════════

    @Transactional
    public TicketTypeOrganizerDTO updateTicketType(UUID eventId, UUID typeId, CreateTicketTypeRequest req, String organizerId) {
        findOwnedEvent(eventId, organizerId); // IDOR check

        TicketType tt = ticketTypeRepository.findByIdAndEventIdAndIsDeletedFalse(typeId, eventId)
            .orElseThrow(() -> new ResourceNotFoundException("Loại vé không tồn tại: " + typeId));

        // Validate: không được giảm quantityTotal xuống dưới số đã bán
        if (req.quantityTotal() != null) {
            Integer sold = ticketTypeRepository.countSoldTickets(typeId);
            int soldCount = sold != null ? sold : 0;
            if (req.quantityTotal() < soldCount) {
                throw new InvalidRequestException(
                    "Không thể đặt số lượng vé (" + req.quantityTotal() +
                    ") thấp hơn số vé đã bán (" + soldCount + ")");
            }
            int delta = req.quantityTotal() - tt.getQuantityTotal();
            eventRepository.adjustTotalCapacity(eventId, delta);
            tt.setQuantityTotal(req.quantityTotal());
            tt.setQuantityAvailable(tt.getQuantityAvailable() + delta);
        }

        // Partial update
        if (req.name() != null) tt.setName(req.name());
        if (req.description() != null) tt.setDescription(req.description());
        if (req.price() != null) tt.setPrice(req.price());
        if (req.originalPrice() != null) tt.setOriginalPrice(req.originalPrice());
        if (req.maxPerOrder() != null) tt.setMaxPerOrder(req.maxPerOrder());
        if (req.seatSelectionEnabled() != null) tt.setSeatSelectionEnabled(req.seatSelectionEnabled());
        if (req.colorCode() != null) tt.setColorCode(req.colorCode());
        if (req.displayOrder() != null) tt.setDisplayOrder(req.displayOrder());
        if (req.eventSectorId() != null) {
            validateEventSectorScope(eventId, req.eventSectorId());
            tt.setEventSectorId(req.eventSectorId());
        }
        if (req.isVisible() != null) tt.setIsVisible(req.isVisible());
        if (req.saleStartDatetime() != null) tt.setSaleStartDatetime(req.saleStartDatetime());
        if (req.saleEndDatetime() != null) tt.setSaleEndDatetime(req.saleEndDatetime());

        tt = ticketTypeRepository.save(tt);
        log.info("Updated ticket type {}", typeId);
        return TicketTypeOrganizerDTO.from(tt);
    }

    // ═══════════════════════════════════════════════════════
    // DELETE (Soft)
    // ═══════════════════════════════════════════════════════

    @Transactional
    public void deleteTicketType(UUID eventId, UUID typeId, String organizerId) {
        findOwnedEvent(eventId, organizerId); // IDOR check

        TicketType tt = ticketTypeRepository.findByIdAndEventIdAndIsDeletedFalse(typeId, eventId)
            .orElseThrow(() -> new ResourceNotFoundException("Loại vé không tồn tại: " + typeId));

        // Chặn nếu đã có vé bán
        Integer sold = ticketTypeRepository.countSoldTickets(typeId);
        if (sold != null && sold > 0) {
            throw new InvalidRequestException(
                "Không thể xóa loại vé đã có " + sold + " vé được bán");
        }

        // Giảm totalCapacity của Event (chỉ phần chưa bán)
        eventRepository.adjustTotalCapacity(eventId, -tt.getQuantityTotal());

        tt.setIsDeleted(true);
        tt.setStatus(TicketType.TicketStatus.HIDDEN);
        ticketTypeRepository.save(tt);

        log.info("Soft deleted ticket type {} from event {}", typeId, eventId);
    }

    // ═══════════════════════════════════════════════════════
    // PRIVATE
    // ═══════════════════════════════════════════════════════

    private Event findOwnedEvent(UUID eventId, String organizerId) {
        return eventRepository.findByIdAndOrganizerIdAndIsDeletedFalse(eventId, organizerId)
            .orElseThrow(() -> new ResourceNotFoundException("Sự kiện không tồn tại: " + eventId));
    }

    private void validateEventSectorScope(UUID eventId, UUID eventSectorId) {
        if (eventSectorId == null) {
            return;
        }
        if (!eventSectorRepository.existsByIdAndEventId(eventSectorId, eventId)) {
            throw new InvalidRequestException("Sector không thuộc event này");
        }
    }
}
