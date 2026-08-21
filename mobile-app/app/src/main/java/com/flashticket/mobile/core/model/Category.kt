package com.flashticket.mobile.core.model

data class Category(
    val id: String,
    val name: String,
    val slug: String,
    val iconUrl: String? = null,
    val displayOrder: Int = 0
)
