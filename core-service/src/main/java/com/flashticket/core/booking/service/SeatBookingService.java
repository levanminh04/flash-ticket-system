package com.flashticket.core.booking.service;

import com.flashticket.core.booking.entity.OrderItemSeat;
import com.flashticket.core.booking.entity.OrderItemSeat.SeatReservationStatus;
import com.flashticket.core.booking.event.SeatStatusChangedEvent;
import com.flashticket.core.booking.repository.OrderItemSeatRepository;
import com.flashticket.core.common.exception.InsufficientStockException;
import com.flashticket.core.common.exception.InvalidRequestException;
import com.flashticket.core.event.entity.EventSeat;
import com.flashticket.core.event.entity.EventSeatInventory;
import com.flashticket.core.event.repository.EventSeatInventoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SeatBookingService {

    private static final String STATUS_AVAILABLE = "AVAILABLE";
    private static final String STATUS_RESERVED = "RESERVED";
    private static final String STATUS_SOLD = "SOLD";

    private final EventSeatInventoryRepository eventSeatInventoryRepository;
    private final OrderItemSeatRepository orderItemSeatRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public void validateSeats(UUID eventId, UUID ticketTypeId, Collection<UUID> seatIds) {
        Map<UUID, EventSeatInventory> inventories = loadSeatInventories(eventId, seatIds);
        if (inventories.size() != seatIds.size()) {
            throw new InvalidRequestException("Một hoặc nhiều ghế không tồn tại trong sự kiện này");
        }

        for (UUID seatId : seatIds) {
            EventSeatInventory inventory = inventories.get(seatId);
            validateSeatInventory(eventId, ticketTypeId, seatId, inventory);
        }
    }

    @Transactional
    public void reserveSeats(
        UUID eventId,
        UUID ticketTypeId,
        UUID orderId,
        UUID orderItemId,
        Collection<UUID> seatIds,
        BigDecimal price
    ) {
        Map<UUID, EventSeatInventory> inventories = loadSeatInventories(eventId, seatIds);
        if (inventories.size() != seatIds.size()) {
            throw new InvalidRequestException("Một hoặc nhiều ghế không tồn tại trong sự kiện này");
        }

        for (UUID seatId : seatIds) {
            validateSeatInventory(eventId, ticketTypeId, seatId, inventories.get(seatId));
            int updated = eventSeatInventoryRepository.reserveSeatIfAvailable(
                seatId, eventId, ticketTypeId, orderId);
            if (updated == 0) {
                throw new InsufficientStockException("Ghế " + seatId, 0, 1);
            }
        }

        List<OrderItemSeat> orderItemSeats = seatIds.stream()
            .map(inventories::get)
            .map(inventory -> buildOrderItemSeat(orderItemId, inventory.getEventSeat(), price))
            .toList();
        orderItemSeatRepository.saveAll(orderItemSeats);

        publishSeatStatuses(eventId, seatIds, STATUS_RESERVED);
    }

    @Transactional
    public void restoreSeatsForOrder(UUID orderId) {
        List<EventSeatInventory> reservedSeats = eventSeatInventoryRepository.findAllByOrderId(orderId).stream()
            .filter(inventory -> STATUS_RESERVED.equals(inventory.getStatus()))
            .toList();
        if (reservedSeats.isEmpty()) {
            return;
        }

        eventSeatInventoryRepository.restoreReservedSeatsForOrder(orderId);
        orderItemSeatRepository.updateStatusForOrder(
            orderId,
            SeatReservationStatus.RESERVED.name(),
            SeatReservationStatus.CANCELLED.name()
        );
        publishSeatStatuses(reservedSeats, STATUS_AVAILABLE);
    }

    @Transactional
    public void confirmSeatsSold(UUID orderId) {
        List<EventSeatInventory> reservedSeats = eventSeatInventoryRepository.findAllByOrderId(orderId).stream()
            .filter(inventory -> STATUS_RESERVED.equals(inventory.getStatus()))
            .toList();
        if (reservedSeats.isEmpty()) {
            return;
        }

        eventSeatInventoryRepository.confirmReservedSeatsForOrder(orderId);
        orderItemSeatRepository.updateStatusForOrder(
            orderId,
            SeatReservationStatus.RESERVED.name(),
            SeatReservationStatus.CONFIRMED.name()
        );
        publishSeatStatuses(reservedSeats, STATUS_SOLD);
    }

    @Transactional
    public void attachTicketToSeatInventory(UUID eventId, UUID seatId, UUID orderId, UUID ticketId) {
        eventSeatInventoryRepository.attachTicketToSeatInventory(eventId, seatId, orderId, ticketId);
    }

    private Map<UUID, EventSeatInventory> loadSeatInventories(UUID eventId, Collection<UUID> seatIds) {
        if (seatIds == null || seatIds.isEmpty()) {
            return Map.of();
        }
        return eventSeatInventoryRepository.findByEventIdAndSeatIdsForValidation(eventId, seatIds).stream()
            .collect(Collectors.toMap(
                inventory -> inventory.getEventSeat().getId(),
                Function.identity(),
                (left, right) -> left,
                LinkedHashMap::new
            ));
    }

    private void validateSeatInventory(
        UUID eventId,
        UUID ticketTypeId,
        UUID seatId,
        EventSeatInventory inventory
    ) {
        if (inventory == null) {
            throw new InvalidRequestException("Ghế không tồn tại trong sự kiện này: " + seatId);
        }
        EventSeat seat = inventory.getEventSeat();
        if (!eventId.equals(inventory.getEventId())) {
            throw new InvalidRequestException("Ghế không thuộc sự kiện này: " + seatId);
        }
        if (!Boolean.TRUE.equals(seat.getIsActive())) {
            throw new InvalidRequestException("Ghế không còn khả dụng: " + seatId);
        }
        if (!ticketTypeId.equals(seat.getTicketTypeId())) {
            throw new InvalidRequestException("Ghế không thuộc loại vé đã chọn: " + seatId);
        }
        if (!ticketTypeId.equals(inventory.getTicketTypeId())) {
            throw new InvalidRequestException("Cấu hình inventory của ghế đã cũ, vui lòng tải lại seat map");
        }
        if (!STATUS_AVAILABLE.equals(inventory.getStatus())) {
            throw new InsufficientStockException("Ghế " + displaySeat(seat), 0, 1);
        }
    }

    private OrderItemSeat buildOrderItemSeat(UUID orderItemId, EventSeat seat, BigDecimal price) {
        return OrderItemSeat.builder()
            .orderItemId(orderItemId)
            .seatId(seat.getId())
            .seatLabel(displaySeat(seat))
            .rowName(seat.getRowName())
            .seatNumber(seat.getSeatNumber())
            .price(price)
            .status(SeatReservationStatus.RESERVED)
            .build();
    }

    private String displaySeat(EventSeat seat) {
        if (seat.getSeatLabel() != null && !seat.getSeatLabel().isBlank()) {
            return seat.getSeatLabel();
        }
        return seat.getRowName() + "-" + seat.getSeatNumber();
    }

    private void publishSeatStatuses(UUID eventId, Collection<UUID> seatIds, String status) {
        Map<UUID, String> statuses = seatIds.stream()
            .collect(Collectors.toMap(Function.identity(), ignored -> status, (left, right) -> left, LinkedHashMap::new));
        eventPublisher.publishEvent(new SeatStatusChangedEvent(eventId, statuses));
    }

    private void publishSeatStatuses(List<EventSeatInventory> seats, String status) {
        Map<UUID, Map<UUID, String>> byEvent = seats.stream()
            .collect(Collectors.groupingBy(
                EventSeatInventory::getEventId,
                Collectors.toMap(
                    inventory -> inventory.getEventSeat().getId(),
                    ignored -> status,
                    (left, right) -> left,
                    LinkedHashMap::new
                )
            ));
        byEvent.forEach((eventId, statuses) ->
            eventPublisher.publishEvent(new SeatStatusChangedEvent(eventId, statuses)));
    }
}
