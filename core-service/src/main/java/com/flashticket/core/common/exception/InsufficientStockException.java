package com.flashticket.core.common.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Ném ra khi không còn đủ vé để đáp ứng yêu cầu booking.
 * HTTP 409 Conflict — phù hợp hơn 400 vì đây là conflict về trạng thái resource.
 */
@ResponseStatus(HttpStatus.CONFLICT)
public class InsufficientStockException extends RuntimeException {

    private final int available;
    private final int requested;

    public InsufficientStockException(String ticketTypeName, int available, int requested) {
        super(String.format("Không đủ vé loại '%s'. Yêu cầu: %d, Còn lại: %d",
            ticketTypeName, requested, available));
        this.available = available;
        this.requested = requested;
    }

    public int getAvailable() { return available; }
    public int getRequested() { return requested; }
}
