package com.flashticket.core.common.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Ném ra khi không lấy được Redis distributed lock trong thời gian quy định.
 * HTTP 503 Service Unavailable — server tạm thời không xử lý được vì có request khác đang chạy.
 */
@ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
public class LockAcquisitionException extends RuntimeException {

    public LockAcquisitionException(String message) {
        super(message);
    }
}
