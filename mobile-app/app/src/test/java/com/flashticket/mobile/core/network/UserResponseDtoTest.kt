package com.flashticket.mobile.core.network

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class UserResponseDtoTest {
    private val json = Json { ignoreUnknownKeys = true }

    @Test
    fun `API-07 payload without legacy fullName maps successfully`() {
        val payload = """
            {
              "id": "test-user-id",
              "keycloakId": "test-keycloak-id",
              "firstName": "Organizer",
              "lastName": "Test",
              "displayName": "Test Organizer",
              "email": "organizer@example.invalid",
              "phone": null,
              "roles": ["ORGANIZER"],
              "status": "ACTIVE",
              "additionalServerField": "ignored"
            }
        """.trimIndent()

        val profile = json.decodeFromString<UserResponseDto>(payload).toDomain()

        assertEquals("Test Organizer", profile.displayName)
        assertEquals("organizer@example.invalid", profile.email)
        assertEquals(listOf("ORGANIZER"), profile.roles)
    }

    @Test
    fun `missing optional profile names falls back to email`() {
        val payload = """
            {
              "id": "test-user-id",
              "email": "organizer@example.invalid",
              "roles": ["ORGANIZER"]
            }
        """.trimIndent()

        val profile = json.decodeFromString<UserResponseDto>(payload).toDomain()

        assertEquals("organizer@example.invalid", profile.displayName)
    }
}
