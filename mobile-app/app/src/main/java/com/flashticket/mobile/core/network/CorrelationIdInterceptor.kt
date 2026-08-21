package com.flashticket.mobile.core.network

import okhttp3.Interceptor
import okhttp3.Response
import java.util.UUID

/**
 * Gắn header X-Correlation-ID vào mỗi request để phục vụ tracing/chẩn đoán (theo ADR-004).
 */
class CorrelationIdInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val correlationId = originalRequest.header("X-Correlation-ID") ?: UUID.randomUUID().toString()
        val requestWithCorrelation = originalRequest.newBuilder()
            .header("X-Correlation-ID", correlationId)
            .build()
        return chain.proceed(requestWithCorrelation)
    }
}
