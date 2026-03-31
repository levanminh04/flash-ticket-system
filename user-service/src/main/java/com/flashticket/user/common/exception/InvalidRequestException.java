package com.flashticket.user.common.exception;

/**
 * Exception khi request không hợp lệ
 * Trả về HTTP 400
 */
public class InvalidRequestException extends RuntimeException {

    public InvalidRequestException(String message) {
        super(message);
    }
}
