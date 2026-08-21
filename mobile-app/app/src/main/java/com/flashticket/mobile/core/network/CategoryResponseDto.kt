package com.flashticket.mobile.core.network

import kotlinx.serialization.Serializable

@Serializable
data class CategoryResponseDto(
    val id: String,
    val name: String,
    val slug: String,
    val iconUrl: String? = null,
    val displayOrder: Int = 0
)
