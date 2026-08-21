package com.flashticket.mobile.core.database

import com.flashticket.mobile.core.model.Category
import com.flashticket.mobile.core.network.CategoryResponseDto

internal fun CategoryResponseDto.toEntity(cachedAt: Long): CategoryEntity = CategoryEntity(
    id = id,
    name = name,
    slug = slug,
    iconUrl = iconUrl,
    displayOrder = displayOrder,
    cachedAt = cachedAt
)

internal fun CategoryEntity.toDomain(): Category = Category(
    id = id,
    name = name,
    slug = slug,
    iconUrl = iconUrl,
    displayOrder = displayOrder
)
