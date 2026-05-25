package com.flashticket.core.booking.service;

import com.flashticket.core.booking.repository.OrderItemSeatRepository;
import com.flashticket.core.common.exception.InvalidRequestException;
import com.flashticket.core.event.entity.EventSeat;
import com.flashticket.core.event.entity.EventSeatInventory;
import com.flashticket.core.event.repository.EventSeatInventoryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SeatBookingServiceTest {

    @Mock
    private EventSeatInventoryRepository eventSeatInventoryRepository;

    @Mock
    private OrderItemSeatRepository orderItemSeatRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private SeatBookingService seatBookingService;

    @Test
    void reserveSeats_recordsOrderItemSeatAndPublishesCacheEvent() {
        UUID eventId = UUID.randomUUID();
        UUID ticketTypeId = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        UUID orderItemId = UUID.randomUUID();
        UUID seatId = UUID.randomUUID();
        EventSeatInventory inventory = inventory(eventId, ticketTypeId, seatId, "AVAILABLE");

        when(eventSeatInventoryRepository.findByEventIdAndSeatIdsForValidation(eventId, List.of(seatId)))
            .thenReturn(List.of(inventory));
        when(eventSeatInventoryRepository.reserveSeatIfAvailable(seatId, eventId, ticketTypeId, orderId))
            .thenReturn(1);

        seatBookingService.reserveSeats(
            eventId, ticketTypeId, orderId, orderItemId, List.of(seatId), BigDecimal.valueOf(100_000));

        ArgumentCaptor<List> captor = ArgumentCaptor.forClass(List.class);
        verify(orderItemSeatRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(1);
        verify(eventPublisher).publishEvent(any(Object.class));
    }

    @Test
    void validateSeats_rejectsStaleTicketTypeSnapshot() {
        UUID eventId = UUID.randomUUID();
        UUID ticketTypeId = UUID.randomUUID();
        UUID seatId = UUID.randomUUID();
        EventSeatInventory inventory = inventory(eventId, UUID.randomUUID(), seatId, "AVAILABLE");

        when(eventSeatInventoryRepository.findByEventIdAndSeatIdsForValidation(eventId, List.of(seatId)))
            .thenReturn(List.of(inventory));

        assertThatThrownBy(() -> seatBookingService.validateSeats(eventId, ticketTypeId, List.of(seatId)))
            .isInstanceOf(InvalidRequestException.class);
    }

    private EventSeatInventory inventory(UUID eventId, UUID ticketTypeId, UUID seatId, String status) {
        EventSeat seat = new EventSeat();
        seat.setId(seatId);
        seat.setTicketTypeId(ticketTypeId);
        seat.setRowName("A");
        seat.setSeatNumber("1");
        seat.setSeatLabel("A-1");
        seat.setIsActive(true);

        EventSeatInventory inventory = new EventSeatInventory();
        inventory.setEventId(eventId);
        inventory.setTicketTypeId(ticketTypeId);
        inventory.setEventSeat(seat);
        inventory.setStatus(status);
        return inventory;
    }
}
