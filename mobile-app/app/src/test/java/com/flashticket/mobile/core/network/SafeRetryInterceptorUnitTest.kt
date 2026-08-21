package com.flashticket.mobile.core.network

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import java.io.IOException
import java.net.ProtocolException

class SafeRetryInterceptorUnitTest {

    private lateinit var mockWebServer: MockWebServer
    private lateinit var okHttpClient: OkHttpClient
    private val recordedDelays = mutableListOf<Long>()

    @Before
    fun setUp() {
        mockWebServer = MockWebServer()
        mockWebServer.start()

        okHttpClient = OkHttpClient.Builder()
            .addInterceptor(
                SafeRetryInterceptor(
                    maxReadRetries = 1,
                    baseDelayMillis = 200L,
                    maxDelayMillis = 200L,
                    jitterRatio = 0.0,
                    sleeper = RetrySleeper(recordedDelays::add)
                )
            )
            .build()
    }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
    }

    @Test
    fun getSafeRead_onTransientNetworkFailure_retriesOnceAndSucceeds() {
        // Lần 1 ngắt kết nối tạm thời, lần 2 trả 200 OK
        mockWebServer.enqueue(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AT_START))
        mockWebServer.enqueue(MockResponse().setResponseCode(200).setBody("""{"status": "OK"}"""))

        val request = Request.Builder()
            .url(mockWebServer.url("/api/events"))
            .get()
            .withRetryPolicy(RetryPolicy.SAFE_READ)
            .build()

        val response = okHttpClient.newCall(request).execute()

        assertEquals(200, response.code)
        // Xác nhận đã thực hiện 2 lần thử (1 initial + 1 retry)
        assertEquals(2, mockWebServer.requestCount)
        assertEquals(listOf(200L), recordedDelays)
    }

    @Test
    fun untaggedGet_onTransientNetworkFailure_doesNotRetry() {
        mockWebServer.enqueue(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AT_START))

        val request = Request.Builder()
            .url(mockWebServer.url("/api/events"))
            .get()
            .build()

        try {
            okHttpClient.newCall(request).execute()
            fail("Untagged GET must not retry")
        } catch (exception: IOException) {
            assertEquals(1, mockWebServer.requestCount)
        }
    }

    @Test
    fun postMutation_onTransientNetworkFailure_doesNotRetry() {
        mockWebServer.enqueue(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AT_START))

        val request = Request.Builder()
            .url(mockWebServer.url("/api/orders"))
            .post("{}".toRequestBody("application/json".toMediaType()))
            .withRetryPolicy(RetryPolicy.SAFE_READ)
            .build()

        try {
            okHttpClient.newCall(request).execute()
            fail("Mutation must throw IOException on network disconnect and NOT retry")
        } catch (e: IOException) {
            // Mutation tuyệt đối không được auto-retry (chỉ gửi đúng 1 lần)
            assertEquals(1, mockWebServer.requestCount)
        }
    }

    @Test
    fun checkInEndpoint_onFailure_neverAutoRetries() {
        mockWebServer.enqueue(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AT_START))

        val request = Request.Builder()
            .url(mockWebServer.url("/api/tickets/checkin"))
            .post("{}".toRequestBody("application/json".toMediaType()))
            .build()

        try {
            okHttpClient.newCall(request).execute()
            fail("Check-in request must not auto-retry")
        } catch (e: IOException) {
            assertEquals(1, mockWebServer.requestCount)
        }
    }

    @Test
    fun safeRead_onProtocolFailure_doesNotRetry() {
        assertFalse(ProtocolException("Malformed HTTP response").isTransientNetworkFailure())
    }

    @Test
    fun mediaUploadEndpoint_onFailure_neverAutoRetries() {
        mockWebServer.enqueue(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AT_START))

        val request = Request.Builder()
            .url(mockWebServer.url("/api/organizer/upload"))
            .post("binary-data".toRequestBody("application/octet-stream".toMediaType()))
            .build()

        try {
            okHttpClient.newCall(request).execute()
            fail("Upload request must not auto-retry")
        } catch (e: IOException) {
            assertEquals(1, mockWebServer.requestCount)
        }
    }
}
