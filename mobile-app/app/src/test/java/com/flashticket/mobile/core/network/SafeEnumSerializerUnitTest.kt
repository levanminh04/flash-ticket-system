package com.flashticket.mobile.core.network

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

enum class TicketStatus {
    ISSUED,
    USED,
    CANCELLED,
    UNKNOWN;

    object Serializer : SafeEnumSerializer<TicketStatus>(
        serialName = "TicketStatus",
        enumEntries = entries.toTypedArray(),
        default = UNKNOWN
    )
}

@Serializable
data class TicketStatusDto(
    val ticketId: String,
    @Serializable(with = TicketStatus.Serializer::class)
    val status: TicketStatus
)

class SafeEnumSerializerUnitTest {

    private lateinit var json: Json

    @Before
    fun setUp() {
        json = Json {
            ignoreUnknownKeys = true
            coerceInputValues = true
            isLenient = false
            encodeDefaults = false
        }
    }

    @Test
    fun deserialize_knownEnumValue_parsesCorrectEnum() {
        val jsonString = """{"ticketId": "t-1", "status": "ISSUED"}"""
        val dto = json.decodeFromString<TicketStatusDto>(jsonString)

        assertEquals("t-1", dto.ticketId)
        assertEquals(TicketStatus.ISSUED, dto.status)
    }

    @Test
    fun deserialize_unknownFutureEnumValue_fallsBackToUnknownWithoutCrashing() {
        // Backend trả về một status mới mà app hiện tại chưa biết: "TRANSFERRED"
        val jsonString = """{"ticketId": "t-2", "status": "TRANSFERRED"}"""
        val dto = json.decodeFromString<TicketStatusDto>(jsonString)

        assertEquals("t-2", dto.ticketId)
        // Không crash SerializationException -> fallback an toàn về TicketStatus.UNKNOWN
        assertEquals(TicketStatus.UNKNOWN, dto.status)
    }
}
