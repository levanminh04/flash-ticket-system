package com.flashticket.mobile.core.auth

import android.net.Uri
import net.openid.appauth.connectivity.ConnectionBuilder
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

internal object RemoteEndpointPolicy {
    fun isAllowed(scheme: String?, host: String?, allowedCleartextHost: String): Boolean {
        val usesHttps = scheme.equals("https", ignoreCase = true)
        val usesAcceptedHttp = scheme.equals("http", ignoreCase = true) &&
            host.equals(allowedCleartextHost, ignoreCase = true)
        return usesHttps || usesAcceptedHttp
    }
}

/**
 * Allows AppAuth to use HTTPS normally and the explicitly accepted production HTTP host only.
 */
internal class RestrictedConnectionBuilder(
    private val allowedCleartextHost: String
) : ConnectionBuilder {
    override fun openConnection(uri: Uri): HttpURLConnection {
        if (!RemoteEndpointPolicy.isAllowed(uri.scheme, uri.host, allowedCleartextHost)) {
            throw IOException("AppAuth endpoint is outside the allowed production hosts")
        }

        return (URL(uri.toString()).openConnection() as HttpURLConnection).apply {
            connectTimeout = CONNECT_TIMEOUT_MILLIS
            readTimeout = READ_TIMEOUT_MILLIS
            instanceFollowRedirects = false
        }
    }

    private companion object {
        const val CONNECT_TIMEOUT_MILLIS = 15_000
        const val READ_TIMEOUT_MILLIS = 10_000
    }
}
