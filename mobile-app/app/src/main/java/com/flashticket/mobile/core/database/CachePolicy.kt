package com.flashticket.mobile.core.database

enum class CacheStrategy {
    NETWORK_FIRST,
    CACHE_FIRST,
    STALE_WHILE_REVALIDATE
}

data class CachePolicy(
    val strategy: CacheStrategy,
    val ttlMillis: Long
) {
    fun isExpired(cachedAt: Long, currentTimeMillis: Long = System.currentTimeMillis()): Boolean {
        return (currentTimeMillis - cachedAt) > ttlMillis
    }

    companion object {
        /** Danh mục sự kiện: Cache-first, TTL 24 giờ (dữ liệu công khai, ít thay đổi) */
        val Category = CachePolicy(CacheStrategy.CACHE_FIRST, 24 * 60 * 60 * 1000L)

        /** Khám phá sự kiện: Network-first với cache fallback, TTL 15 phút */
        val EventDiscovery = CachePolicy(CacheStrategy.NETWORK_FIRST, 15 * 60 * 1000L)

        /** Vé người dùng: Network-first với user partition, TTL 1 giờ */
        val UserTickets = CachePolicy(CacheStrategy.NETWORK_FIRST, 60 * 60 * 1000L)

        /** Hồ sơ Organizer công khai: Cache-first, TTL 1 giờ */
        val OrganizerPublic = CachePolicy(CacheStrategy.CACHE_FIRST, 60 * 60 * 1000L)
    }
}
