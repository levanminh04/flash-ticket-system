package com.flashticket.mobile.core.network

import com.flashticket.mobile.BuildConfig
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Gắn các headers metadata về phiên bản app và nền tảng (theo ADR-004).
 */
class AppMetadataInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request().newBuilder()
            .header("X-App-Version", BuildConfig.VERSION_NAME)
            .header("X-Platform", "Android")
            .header("X-Build-Type", BuildConfig.BUILD_TYPE)
            .build()
        return chain.proceed(request)
    }
}
