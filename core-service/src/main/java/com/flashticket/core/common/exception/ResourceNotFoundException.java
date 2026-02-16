package com.flashticket.core.common.exception;

/**
 * Exception khi resource không tìm thấy
 * Trả về HTTP 404
 */
public class ResourceNotFoundException extends RuntimeException {
    
    public ResourceNotFoundException(String message) {
        super(message);
    }
    
    public ResourceNotFoundException(String resource, String field, Object value) {
        super(String.format("%s not found with %s: %s", resource, field, value));
    }
}
