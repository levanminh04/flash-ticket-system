package com.flashticket.mobile.core.network

import com.flashticket.mobile.core.network.DynamicTimeoutInterceptor.Companion.withTimeoutType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class TimeoutPolicyUnitTest {

    private lateinit var mockWebServer: MockWebServer
    private var observedTimeouts: Triple<Int, Int, Int>? = null

    @Before
    fun setUp() {
        mockWebServer = MockWebServer()
        mockWebServer.start()
    }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
    }

    @Test
    fun defaultReadPolicy_uses15SecondsTimeouts() {
        assertEquals(15_000L, TimeoutPolicy.DefaultRead.connectTimeoutMs)
        assertEquals(15_000L, TimeoutPolicy.DefaultRead.readTimeoutMs)
        assertEquals(15_000L, TimeoutPolicy.DefaultRead.writeTimeoutMs)
    }

    @Test
    fun mediaUploadPolicy_usesExtended60SecondsTimeouts() {
        assertEquals(30_000L, TimeoutPolicy.MediaUpload.connectTimeoutMs)
        assertEquals(60_000L, TimeoutPolicy.MediaUpload.readTimeoutMs)
        assertEquals(60_000L, TimeoutPolicy.MediaUpload.writeTimeoutMs)
    }

    @Test
    fun checkInPolicy_usesFast10SecondsTimeouts() {
        assertEquals(10_000L, TimeoutPolicy.CheckIn.connectTimeoutMs)
        assertEquals(10_000L, TimeoutPolicy.CheckIn.readTimeoutMs)
        assertEquals(10_000L, TimeoutPolicy.CheckIn.writeTimeoutMs)
    }

    @Test
    fun dynamicTimeoutInterceptor_withTypedCheckInTag_appliesCheckInTimeoutAndStripsHeader() {
        mockWebServer.enqueue(MockResponse().setResponseCode(200).setBody("{}"))

        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(DynamicTimeoutInterceptor())
            .addInterceptor { chain ->
                observedTimeouts = Triple(
                    chain.connectTimeoutMillis(),
                    chain.readTimeoutMillis(),
                    chain.writeTimeoutMillis()
                )
                chain.proceed(chain.request())
            }
            .build()

        val request = Request.Builder()
            .url(mockWebServer.url("/api/tickets/checkin"))
            .withTimeoutType(TimeoutType.CHECK_IN)
            .build()

        val response = okHttpClient.newCall(request).execute()
        assertEquals(200, response.code)
        assertEquals(Triple(10_000, 10_000, 10_000), observedTimeouts)

        val recordedRequest = mockWebServer.takeRequest()
        assertNull(recordedRequest.getHeader(DynamicTimeoutInterceptor.HEADER_TIMEOUT_TYPE))
    }

    @Test
    fun dynamicTimeoutInterceptor_withTypedMediaUploadTag_appliesMediaUploadTimeoutAndStripsHeader() {
        mockWebServer.enqueue(MockResponse().setResponseCode(200).setBody("{}"))

        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(DynamicTimeoutInterceptor())
            .addInterceptor { chain ->
                observedTimeouts = Triple(
                    chain.connectTimeoutMillis(),
                    chain.readTimeoutMillis(),
                    chain.writeTimeoutMillis()
                )
                chain.proceed(chain.request())
            }
            .build()

        val request = Request.Builder()
            .url(mockWebServer.url("/api/organizer/upload"))
            .withTimeoutType(TimeoutType.MEDIA_UPLOAD)
            .build()

        val response = okHttpClient.newCall(request).execute()
        assertEquals(200, response.code)
        assertEquals(Triple(30_000, 60_000, 60_000), observedTimeouts)

        val recordedRequest = mockWebServer.takeRequest()
        assertNull(recordedRequest.getHeader(DynamicTimeoutInterceptor.HEADER_TIMEOUT_TYPE))
    }
}
