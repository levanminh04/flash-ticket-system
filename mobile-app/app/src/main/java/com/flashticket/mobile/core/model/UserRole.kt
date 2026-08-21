package com.flashticket.mobile.core.model

import kotlinx.serialization.Serializable

@Serializable
enum class UserRole {
    BUYER,
    ORGANIZER,
    ADMIN;

    companion object {
        fun fromString(value: String): UserRole? = when (value.trim().uppercase()) {
            "BUYER", "ROLE_BUYER", "USER", "ROLE_USER" -> BUYER
            "ORGANIZER", "ROLE_ORGANIZER" -> ORGANIZER
            "ADMIN", "ROLE_ADMIN" -> ADMIN
            else -> null
        }

        fun resolve(roles: List<String>?): UserRole {
            if (roles.isNullOrEmpty()) return BUYER
            val normalizedRoles = roles.map { it.trim().uppercase() }
            return when {
                normalizedRoles.any { it == "ADMIN" || it == "ROLE_ADMIN" } -> ADMIN
                normalizedRoles.any { it == "ORGANIZER" || it == "ROLE_ORGANIZER" } -> ORGANIZER
                normalizedRoles.any { it == "BUYER" || it == "ROLE_BUYER" || it == "USER" || it == "ROLE_USER" } -> BUYER
                else -> BUYER
            }
        }
    }
}
