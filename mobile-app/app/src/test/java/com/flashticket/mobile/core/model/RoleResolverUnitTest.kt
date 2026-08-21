package com.flashticket.mobile.core.model

import org.junit.Assert.assertEquals
import org.junit.Test

class RoleResolverUnitTest {

    @Test
    fun resolve_nullOrEmptyRoles_returnsBuyer() {
        assertEquals(UserRole.BUYER, UserRole.resolve(null))
        assertEquals(UserRole.BUYER, UserRole.resolve(emptyList()))
    }

    @Test
    fun resolve_buyerRoles_returnsBuyer() {
        assertEquals(UserRole.BUYER, UserRole.resolve(listOf("BUYER")))
        assertEquals(UserRole.BUYER, UserRole.resolve(listOf("ROLE_BUYER")))
        assertEquals(UserRole.BUYER, UserRole.resolve(listOf("USER")))
        assertEquals(UserRole.BUYER, UserRole.resolve(listOf("ROLE_USER")))
        assertEquals(UserRole.BUYER, UserRole.resolve(listOf(" buyer ")))
    }

    @Test
    fun resolve_organizerRoles_returnsOrganizer() {
        assertEquals(UserRole.ORGANIZER, UserRole.resolve(listOf("ORGANIZER")))
        assertEquals(UserRole.ORGANIZER, UserRole.resolve(listOf("ROLE_ORGANIZER")))
        assertEquals(UserRole.ORGANIZER, UserRole.resolve(listOf(" organizer ")))
    }

    @Test
    fun resolve_adminRoles_returnsAdmin() {
        assertEquals(UserRole.ADMIN, UserRole.resolve(listOf("ADMIN")))
        assertEquals(UserRole.ADMIN, UserRole.resolve(listOf("ROLE_ADMIN")))
        assertEquals(UserRole.ADMIN, UserRole.resolve(listOf(" admin ")))
    }

    @Test
    fun resolve_multiRolePrecedence_prioritizesAdminOverOrganizerAndBuyer() {
        assertEquals(UserRole.ADMIN, UserRole.resolve(listOf("ROLE_BUYER", "ROLE_ORGANIZER", "ROLE_ADMIN")))
        assertEquals(UserRole.ADMIN, UserRole.resolve(listOf("ORGANIZER", "ADMIN")))
        assertEquals(UserRole.ORGANIZER, UserRole.resolve(listOf("BUYER", "ORGANIZER")))
    }

    @Test
    fun resolve_unknownRole_fallsBackSafelyToBuyer() {
        assertEquals(UserRole.BUYER, UserRole.resolve(listOf("SUPERVISOR")))
        assertEquals(UserRole.BUYER, UserRole.resolve(listOf("STAFF", "UNKNOWN_ROLE")))
    }
}
