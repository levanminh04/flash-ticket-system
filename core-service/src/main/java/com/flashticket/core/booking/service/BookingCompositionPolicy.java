package com.flashticket.core.booking.service;

import com.flashticket.core.common.exception.InvalidRequestException;
import com.flashticket.core.event.entity.TicketType.InventoryMode;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class BookingCompositionPolicy {

    public void validateSingleInventoryMode(Collection<InventoryMode> requestedModes) {
        Set<InventoryMode> modes = requestedModes.stream().collect(Collectors.toSet());
        if (modes.size() > 1) {
            throw new InvalidRequestException(
                "Một đơn hàng hiện chỉ được chứa một hình thức vé: chọn số lượng hoặc chọn ghế.");
        }
    }
}
