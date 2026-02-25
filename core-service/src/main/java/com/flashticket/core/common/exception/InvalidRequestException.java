package com.flashticket.core.common.exception;

/**
 * Exception cho invalid request (bad input)
 * Trả về HTTP 400 Bad Request
 */
public class InvalidRequestException extends RuntimeException {
    
    public InvalidRequestException(String message) {
        super(message);
    }
    
    public InvalidRequestException(String message, Throwable cause) {
        super(message, cause);
    }
}
