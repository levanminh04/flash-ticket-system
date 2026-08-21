package com.flashticket.mobile.core.network

import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response
import retrofit2.Invocation
import java.util.concurrent.TimeUnit

enum class TimeoutType {
    DEFAULT_READ,
    MEDIA_UPLOAD,
    CHECK_IN
}

@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION)
annotation class TimeoutPolicyTag(val value: TimeoutType)

data class TimeoutPolicy(
    val connectTimeoutMs: Long,
    val readTimeoutMs: Long,
    val writeTimeoutMs: Long
) {
    companion object {
        /** Default Read API: 15s connect, 15s read, 15s write */
        val DefaultRead = TimeoutPolicy(15_000L, 15_000L, 15_000L)

        /** Media Upload (Organizer banner/logo): 30s connect, 60s read, 60s write */
        val MediaUpload = TimeoutPolicy(30_000L, 60_000L, 60_000L)

        /** Check-in & Real-time: 10s connect, 10s read, 10s write (No mutation retry) */
        val CheckIn = TimeoutPolicy(10_000L, 10_000L, 10_000L)
    }
}

/**
 * DynamicTimeoutInterceptor theo ADR-004:
 * Tự động điều chỉnh timeout per-request dựa trên typed tag TimeoutType hoặc header X-Timeout-Type.
 */
class DynamicTimeoutInterceptor : Interceptor {
    companion object {
        const val HEADER_TIMEOUT_TYPE = "X-Timeout-Type"

        fun Request.Builder.withTimeoutType(type: TimeoutType): Request.Builder {
            return this.tag(TimeoutType::class.java, type)
                .header(HEADER_TIMEOUT_TYPE, type.name)
        }
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val tagType = request.tag(TimeoutType::class.java)
        val headerTypeString = request.header(HEADER_TIMEOUT_TYPE)

        val annotationType = request.tag(Invocation::class.java)
            ?.method()
            ?.getAnnotation(TimeoutPolicyTag::class.java)
            ?.value

        val resolvedType = tagType ?: annotationType ?: headerTypeString?.let { str ->
            TimeoutType.entries.firstOrNull { it.name.equals(str.trim(), ignoreCase = true) }
        } ?: TimeoutType.DEFAULT_READ

        val policy = when (resolvedType) {
            TimeoutType.MEDIA_UPLOAD -> TimeoutPolicy.MediaUpload
            TimeoutType.CHECK_IN -> TimeoutPolicy.CheckIn
            TimeoutType.DEFAULT_READ -> TimeoutPolicy.DefaultRead
        }

        val newRequest = request.newBuilder()
            .removeHeader(HEADER_TIMEOUT_TYPE)
            .build()

        return chain
            .withConnectTimeout(policy.connectTimeoutMs.toInt(), TimeUnit.MILLISECONDS)
            .withReadTimeout(policy.readTimeoutMs.toInt(), TimeUnit.MILLISECONDS)
            .withWriteTimeout(policy.writeTimeoutMs.toInt(), TimeUnit.MILLISECONDS)
            .proceed(newRequest)
    }
}
