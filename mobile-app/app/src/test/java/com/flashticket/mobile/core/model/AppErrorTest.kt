package com.flashticket.mobile.core.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AppErrorTest {

    @Test
    fun userRole_fromString_mapsCorrectly() {
        assertEquals(UserRole.BUYER, UserRole.fromString("BUYER"))
        assertEquals(UserRole.BUYER, UserRole.fromString("ROLE_BUYER"))
        assertEquals(UserRole.ORGANIZER, UserRole.fromString("ORGANIZER"))
        assertEquals(UserRole.ORGANIZER, UserRole.fromString("ROLE_ORGANIZER"))
        assertEquals(UserRole.ADMIN, UserRole.fromString("ADMIN"))
        assertEquals(UserRole.ADMIN, UserRole.fromString("ROLE_ADMIN"))
        assertNull(UserRole.fromString("UNKNOWN_ROLE"))
    }

    @Test
    fun appError_hierarchy_createsCorrectTypes() {
        val networkError = AppError.NetworkUnavailable()
        assertEquals(
            "Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng.",
            networkError.message
        )

        val sessionExpired = AppError.SessionExpired()
        assertEquals("Phiên đăng nhập đã hết hạn.", sessionExpired.message)
        assertEquals(401, sessionExpired.httpStatus)

        val forbidden = AppError.Forbidden()
        assertEquals("Bạn không có quyền thực hiện thao tác này.", forbidden.message)
        assertEquals(403, forbidden.httpStatus)

        val notFound = AppError.NotFound("Ticket", "TKT-001")
        assertEquals("Ticket", notFound.resource)
        assertEquals("TKT-001", notFound.identifier)

        val validation = AppError.Validation(mapOf("phone" to "Invalid format"), "Validation failed")
        assertEquals("Invalid format", validation.fieldErrors["phone"])

        val conflict = AppError.Conflict("Already applied")
        assertEquals("Already applied", conflict.message)

        val server = AppError.Server(500, "Internal Server Error")
        assertEquals(500, server.code)
        assertEquals(500, server.httpStatus)
    }
}
