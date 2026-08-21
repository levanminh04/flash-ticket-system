package com.flashticket.mobile.core.network

import com.flashticket.mobile.core.model.UserProfile
import kotlinx.serialization.Serializable

@Serializable(with = UserStatus.Serializer::class)
enum class UserStatus {
    ACTIVE,
    INACTIVE,
    PENDING_VERIFICATION,
    SUSPENDED,
    UNKNOWN;

    object Serializer : SafeEnumSerializer<UserStatus>(
        serialName = "UserStatus",
        enumEntries = entries.toTypedArray(),
        default = UNKNOWN
    )
}

/** Network DTO matching user-service UserResponse for API-07 and API-08. */
@Serializable
data class UserResponseDto(
    val id: String,
    val keycloakId: String? = null,
    val firstName: String? = null,
    val lastName: String? = null,
    val displayName: String? = null,
    val avatarUrl: String? = null,
    val bio: String? = null,
    val dateOfBirth: String? = null,
    val gender: String? = null,
    val email: String,
    val emailVerified: Boolean? = null,
    val phone: String? = null,
    val phoneVerified: Boolean? = null,
    val roles: List<String> = emptyList(),
    val status: UserStatus = UserStatus.UNKNOWN,
    val organizerProfileId: String? = null,
    val language: String? = null,
    val timezone: String? = null,
    val currency: String? = null,
    val lastLoginAt: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

internal fun UserResponseDto.toDomain(): UserProfile {
    val backendDisplayName = displayName.nonBlankOrNull()
    val composedName = listOfNotNull(
        lastName.nonBlankOrNull(),
        firstName.nonBlankOrNull()
    ).joinToString(" ")

    return UserProfile(
        id = id,
        email = email,
        displayName = backendDisplayName ?: composedName.ifBlank { email },
        phoneNumber = phone,
        avatarUrl = avatarUrl,
        roles = roles,
        status = status.name
    )
}

private fun String?.nonBlankOrNull(): String? = this?.trim()?.takeIf(String::isNotEmpty)
