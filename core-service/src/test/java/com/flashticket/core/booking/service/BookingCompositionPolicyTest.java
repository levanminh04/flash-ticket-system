package com.flashticket.core.booking.service;

import com.flashticket.core.common.exception.InvalidRequestException;
import com.flashticket.core.event.entity.TicketType.InventoryMode;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BookingCompositionPolicyTest {

    private final BookingCompositionPolicy policy = new BookingCompositionPolicy();

    @Test
    void validateSingleInventoryMode_allowsOneMode() {
        assertThatCode(() -> policy.validateSingleInventoryMode(
            List.of(InventoryMode.ASSIGNED_SEAT, InventoryMode.ASSIGNED_SEAT)))
            .doesNotThrowAnyException();
    }

    @Test
    void validateSingleInventoryMode_rejectsMixedMode() {
        assertThatThrownBy(() -> policy.validateSingleInventoryMode(
            List.of(InventoryMode.QUANTITY, InventoryMode.ASSIGNED_SEAT)))
            .isInstanceOf(InvalidRequestException.class);
    }
}
