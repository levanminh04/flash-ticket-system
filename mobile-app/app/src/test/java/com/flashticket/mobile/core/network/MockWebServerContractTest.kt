package com.flashticket.mobile.core.network

import android.content.Intent
import com.flashticket.mobile.core.auth.AuthCallbackResult
import com.flashticket.mobile.core.auth.AuthSessionController
import com.flashticket.mobile.core.auth.LocalLogoutResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import net.openid.appauth.AuthState
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

class MockWebServerContractTest {

    private lateinit var mockWebServer: MockWebServer
    private lateinit var userApiService: UserApiService

    private class FakeAuthSessionController(
        private val token: String? = "test-valid-bearer-token"
    ) : AuthSessionController {
        override val isAuthenticated: Boolean = token != null
        override val authStateFlow: StateFlow<AuthState?> = MutableStateFlow(null)

        override fun createAuthorizationIntent(): Intent = Intent()
        override suspend fun handleAuthorizationResponse(intent: Intent): Boolean = true
        override suspend fun processAuthorizationResponse(intent: Intent): AuthCallbackResult = AuthCallbackResult.Success
        override suspend fun getValidAccessToken(): String? = token
        override suspend fun refreshAccessToken(failedToken: String?): String? = token
        override fun createEndSessionIntent(): Intent? = null
        override suspend fun logout(): LocalLogoutResult = LocalLogoutResult()
    }

    @Before
    fun setUp() {
        mockWebServer = MockWebServer()
        mockWebServer.start()

        val json = Json {
            ignoreUnknownKeys = true
            coerceInputValues = true
            isLenient = false
            encodeDefaults = false
        }

        val authController = FakeAuthSessionController()
        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(DynamicTimeoutInterceptor())
            .addInterceptor(SafeRetryInterceptor())
            .addInterceptor(CorrelationIdInterceptor())
            .addInterceptor(AppMetadataInterceptor())
            .addInterceptor(AuthInterceptor(authController))
            .authenticator(TokenAuthenticator(authController))
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl(mockWebServer.url("/"))
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()

        userApiService = retrofit.create(UserApiService::class.java)
    }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
    }

    @Test
    fun httpPipeline_attachesAuthBearerCorrelationIdAndPlatformMetadata() = runBlocking {
        val mockResponseBody = """
            {
                "id": "user-123",
                "email": "buyer@test.com",
                "fullName": "Buyer Test",
                "roles": ["ROLE_BUYER"],
                "status": "ACTIVE"
            }
        """.trimIndent()

        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(mockResponseBody)
        )

        val userDto = userApiService.getCurrentUser()
        val recordedRequest = mockWebServer.takeRequest()

        assertEquals("user-123", userDto.id)
        assertEquals("buyer@test.com", userDto.email)
        assertEquals(UserStatus.ACTIVE, userDto.status)

        // Kiểm tra Auth Header
        assertEquals("Bearer test-valid-bearer-token", recordedRequest.getHeader("Authorization"))

        // Kiểm tra Correlation ID
        val correlationId = recordedRequest.getHeader("X-Correlation-ID")
        assertNotNull(correlationId)

        // Kiểm tra Platform Metadata
        assertEquals("Android", recordedRequest.getHeader("X-Platform"))
        assertNotNull(recordedRequest.getHeader("X-App-Version"))
    }

    @Test
    fun jsonParsing_handlesAdditiveFieldsAndUnknownKeys_withoutFailing() = runBlocking {
        // Backend bổ sung các trường mới chưa có trong DTO
        val mockResponseBody = """
            {
                "id": "user-456",
                "email": "org@test.com",
                "fullName": "Organizer Test",
                "roles": ["ROLE_ORGANIZER"],
                "status": "ACTIVE",
                "unexpectedFutureField": "should be ignored",
                "extraNestedObject": {
                    "someKey": 999,
                    "active": true
                }
            }
        """.trimIndent()

        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(mockResponseBody)
        )

        val userDto = userApiService.getCurrentUser()
        assertEquals("user-456", userDto.id)
        assertEquals("org@test.com", userDto.email)
        assertEquals(listOf("ROLE_ORGANIZER"), userDto.roles)
    }

    @Test
    fun jsonParsing_handlesUnknownEnum_withSafeFallbackWithoutCrashing() = runBlocking {
        // Backend trả về status enum mới trong tương lai
        val mockResponseBody = """
            {
                "id": "user-789",
                "email": "future@test.com",
                "roles": ["ROLE_BUYER"],
                "status": "NEW_FUTURE_UNKNOWN_STATUS"
            }
        """.trimIndent()

        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(mockResponseBody)
        )

        val userDto = userApiService.getCurrentUser()
        assertEquals("user-789", userDto.id)
        // Không crash -> SafeEnumSerializer tự map về UserStatus.UNKNOWN
        assertEquals(UserStatus.UNKNOWN, userDto.status)
    }

    @Test
    fun jsonParsing_handlesBackendPendingVerificationStatus() = runBlocking {
        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(
                    """{"id":"user-pending","email":"pending@test.com","status":"PENDING_VERIFICATION"}"""
                )
        )

        val userDto = userApiService.getCurrentUser()

        assertEquals(UserStatus.PENDING_VERIFICATION, userDto.status)
    }

    @Test
    fun retrofitSafeReadAnnotation_retriesOneTransientFailure() = runBlocking {
        mockWebServer.enqueue(MockResponse().setSocketPolicy(SocketPolicy.DISCONNECT_AT_START))
        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody("""{"id":"retry-user","email":"retry@test.com","status":"ACTIVE"}""")
        )

        val userDto = userApiService.getCurrentUser()

        assertEquals("retry-user", userDto.id)
        assertEquals(2, mockWebServer.requestCount)
    }
}
