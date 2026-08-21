package com.flashticket.mobile.core.model

import kotlinx.serialization.Serializable

@Serializable
data class UserProfile(
    val id: String,
    val email: String,
    val displayName: String,
    val phoneNumber: String? = null,
    val avatarUrl: String? = null,
    val roles: List<String> = emptyList(),
    val status: String? = null,
    val primaryRole: UserRole = UserRole.resolve(roles)
)
