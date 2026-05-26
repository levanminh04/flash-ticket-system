package com.flashticket.core.event.service;

import com.flashticket.core.event.repository.TicketTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TicketInventoryCounterService {

    private final TicketTypeRepository ticketTypeRepository;

    public Optional<Integer> findAvailableQuantity(UUID ticketTypeId) {
        return ticketTypeRepository.findAvailableQuantityById(ticketTypeId);
    }

    public int reserveQuantity(UUID ticketTypeId, int amount) {
        return ticketTypeRepository.decrementAvailableAndIncrementReserved(ticketTypeId, amount);
    }

    public void confirmReserved(UUID ticketTypeId, int amount) {
        ticketTypeRepository.decrementReserved(ticketTypeId, amount);
    }

    public void restoreReserved(UUID ticketTypeId, int amount) {
        ticketTypeRepository.restoreQuantity(ticketTypeId, amount);
    }

    public void markSoldOutIfEmpty(UUID ticketTypeId) {
        ticketTypeRepository.markAsSoldOutIfEmpty(ticketTypeId);
    }
}
