package com.flashticket.mobile.core.model

data class UserProfile(
    val id: String,
    val email: String,
    val displayName: String,
    val phoneNumber: String? = null,
    val avatarUrl: String? = null,
    val roles: List<String> = emptyList(),
    val status: String? = null
)
