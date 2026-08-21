package com.flashticket.mobile.core.network

import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response
import retrofit2.Invocation
import java.io.IOException
import java.io.InterruptedIOException
import java.net.ProtocolException
import javax.net.ssl.SSLException
import kotlin.math.min
import kotlin.random.Random

enum class RetryPolicy {
    NO_RETRY,
    SAFE_READ
}

@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION)
annotation class RetryPolicyTag(val value: RetryPolicy)

fun Request.Builder.withRetryPolicy(policy: RetryPolicy): Request.Builder =
    tag(RetryPolicy::class.java, policy)

fun interface RetrySleeper {
    fun sleep(delayMillis: Long)
}

private val DEFAULT_RETRY_SLEEPER = RetrySleeper { delayMillis ->
    try {
        Thread.sleep(delayMillis)
    } catch (exception: InterruptedException) {
        Thread.currentThread().interrupt()
        throw InterruptedIOException("Retry backoff interrupted").apply { initCause(exception) }
    }
}

/** Request mặc định không retry; chỉ GET được đánh dấu SAFE_READ mới được retry. */
class SafeRetryInterceptor(
    private val maxReadRetries: Int = 1,
    private val baseDelayMillis: Long = 200L,
    private val maxDelayMillis: Long = 1_000L,
    private val jitterRatio: Double = 0.2,
    private val random: () -> Double = { Random.nextDouble() },
    private val sleeper: RetrySleeper = DEFAULT_RETRY_SLEEPER
) : Interceptor {

    init {
        require(maxReadRetries >= 0)
        require(baseDelayMillis >= 0)
        require(maxDelayMillis >= baseDelayMillis)
        require(jitterRatio in 0.0..1.0)
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val policy = request.tag(RetryPolicy::class.java)
            ?: request.tag(Invocation::class.java)
                ?.method()
                ?.getAnnotation(RetryPolicyTag::class.java)
                ?.value
            ?: RetryPolicy.NO_RETRY

        if (policy != RetryPolicy.SAFE_READ || !request.method.equals("GET", ignoreCase = true)) {
            return chain.proceed(request)
        }

        var retryCount = 0
        while (true) {
            try {
                return chain.proceed(request)
            } catch (exception: IOException) {
                if (!exception.isTransientNetworkFailure() || retryCount >= maxReadRetries) {
                    throw exception
                }
                retryCount++
                sleeper.sleep(calculateDelayMillis(retryCount))
            }
        }
    }

    private fun calculateDelayMillis(retryCount: Int): Long {
        val multiplier = 1L shl (retryCount - 1).coerceAtMost(30)
        val exponential = if (baseDelayMillis > maxDelayMillis / multiplier) {
            maxDelayMillis
        } else {
            min(maxDelayMillis, baseDelayMillis * multiplier)
        }
        val jitterMultiplier = (1.0 - jitterRatio) +
            (2.0 * jitterRatio * random().coerceIn(0.0, 1.0))
        return (exponential * jitterMultiplier).toLong().coerceIn(0L, maxDelayMillis)
    }
}

internal fun IOException.isTransientNetworkFailure(): Boolean =
    this !is ProtocolException && this !is SSLException
