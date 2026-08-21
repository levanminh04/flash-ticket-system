package com.flashticket.mobile.core.auth

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RemoteEndpointPolicyUnitTest {
    private val productionHost = "15.134.248.39"

    @Test
    fun `accepts HTTP only for the configured production host`() {
        assertTrue(RemoteEndpointPolicy.isAllowed("http", productionHost, productionHost))
        assertFalse(RemoteEndpointPolicy.isAllowed("http", "10.0.2.2", productionHost))
        assertFalse(RemoteEndpointPolicy.isAllowed("http", "localhost", productionHost))
    }

    @Test
    fun `accepts HTTPS to support the future TLS migration`() {
        assertTrue(RemoteEndpointPolicy.isAllowed("https", "api.example.test", productionHost))
    }

    @Test
    fun `rejects non HTTP protocols`() {
        assertFalse(RemoteEndpointPolicy.isAllowed("file", productionHost, productionHost))
        assertFalse(RemoteEndpointPolicy.isAllowed(null, productionHost, productionHost))
    }
}
