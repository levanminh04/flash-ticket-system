package com.flashticket.user.common.exception;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Standard error response format — mirror từ core-service
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ErrorResponse {

    private Instant timestamp;
    private int status;
    private String error;
    private String message;
    private String path;

    public ErrorResponse(int status, String error, String message) {
        this.timestamp = Instant.now();
        this.status = status;
        this.error = error;
        this.message = message;
    }
}
