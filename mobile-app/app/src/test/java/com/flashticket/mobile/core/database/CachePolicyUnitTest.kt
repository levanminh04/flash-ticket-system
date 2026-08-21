package com.flashticket.mobile.core.database

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CachePolicyUnitTest {

    @Test
    fun categoryPolicy_within24Hours_isNotExpired() {
        val now = 100_000_000L
        val cachedAt = now - (10 * 60 * 60 * 1000L) // 10 hours ago

        assertFalse(CachePolicy.Category.isExpired(cachedAt, now))
    }

    @Test
    fun categoryPolicy_after24Hours_isExpired() {
        val now = 100_000_000L
        val cachedAt = now - (25 * 60 * 60 * 1000L) // 25 hours ago

        assertTrue(CachePolicy.Category.isExpired(cachedAt, now))
    }

    @Test
    fun eventDiscoveryPolicy_within15Minutes_isNotExpired() {
        val now = 100_000_000L
        val cachedAt = now - (10 * 60 * 1000L) // 10 minutes ago

        assertFalse(CachePolicy.EventDiscovery.isExpired(cachedAt, now))
    }

    @Test
    fun eventDiscoveryPolicy_after15Minutes_isExpired() {
        val now = 100_000_000L
        val cachedAt = now - (16 * 60 * 1000L) // 16 minutes ago

        assertTrue(CachePolicy.EventDiscovery.isExpired(cachedAt, now))
    }

    @Test
    fun userTicketsPolicy_within1Hour_isNotExpired() {
        val now = 100_000_000L
        val cachedAt = now - (30 * 60 * 1000L) // 30 minutes ago

        assertFalse(CachePolicy.UserTickets.isExpired(cachedAt, now))
    }

    @Test
    fun userTicketsPolicy_after1Hour_isExpired() {
        val now = 100_000_000L
        val cachedAt = now - (61 * 60 * 1000L) // 61 minutes ago

        assertTrue(CachePolicy.UserTickets.isExpired(cachedAt, now))
    }
}
