package com.flashticket.user.common.exception;

/**
 * Exception khi dữ liệu bị xung đột (duplicate, already exists)
 * Trả về HTTP 409 Conflict
 *
 * Ví dụ: Email đã được đăng ký, User đã follow Organizer này rồi.
 */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
