package com.flashticket.mobile.feature.scanner

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CheckInOutcomeAdapterTest {

    @Test
    fun fromErrorResponse_alreadyUsedMessage_returnsAlreadyUsedOutcome() {
        val rawMessage = "Vé đã được sử dụng lúc 2026-08-21 04:00:00 tại Cổng A"
        val outcome = CheckInOutcomeAdapter.fromErrorResponse(400, rawMessage)

        assertTrue("Expected AlreadyUsed outcome", outcome is CheckInOutcome.AlreadyUsed)
        assertEquals(rawMessage, (outcome as CheckInOutcome.AlreadyUsed).message)
    }

    @Test
    fun fromErrorResponse_tamperedSignature_returnsInvalidSignatureOutcome() {
        val rawMessage = "QR code đã bị chỉnh sửa hoặc giả mạo"
        val outcome = CheckInOutcomeAdapter.fromErrorResponse(400, rawMessage)

        assertTrue("Expected InvalidSignature outcome", outcome is CheckInOutcome.InvalidSignature)
        assertEquals(rawMessage, (outcome as CheckInOutcome.InvalidSignature).message)
    }

    @Test
    fun fromErrorResponse_ticketNotFound_returnsNotFoundOutcome() {
        val rawMessage = "Mã vé không tồn tại trong hệ thống"
        val outcome = CheckInOutcomeAdapter.fromErrorResponse(404, rawMessage)

        assertTrue("Expected NotFound outcome", outcome is CheckInOutcome.NotFound)
        assertEquals(rawMessage, (outcome as CheckInOutcome.NotFound).message)
    }

    @Test
    fun fromErrorResponse_invalidStatus_returnsInvalidStatusOutcome() {
        val rawMessage = "Trạng thái vé không hợp lệ để check-in: CANCELLED"
        val outcome = CheckInOutcomeAdapter.fromErrorResponse(400, rawMessage)

        assertTrue("Expected InvalidStatus outcome", outcome is CheckInOutcome.InvalidStatus)
        assertEquals(rawMessage, (outcome as CheckInOutcome.InvalidStatus).message)
    }

    @Test
    fun fromErrorResponse_unknownError_returnsUnknownOutcome() {
        val rawMessage = "Lỗi máy chủ nội bộ bất thường"
        val outcome = CheckInOutcomeAdapter.fromErrorResponse(500, rawMessage)

        assertTrue("Expected Unknown outcome", outcome is CheckInOutcome.Unknown)
        assertEquals(rawMessage, (outcome as CheckInOutcome.Unknown).rawMessage)
    }
}
