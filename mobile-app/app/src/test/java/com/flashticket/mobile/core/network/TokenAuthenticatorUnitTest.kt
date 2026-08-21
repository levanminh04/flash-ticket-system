package com.flashticket.mobile.core.network

import android.content.Intent
import com.flashticket.mobile.core.auth.AuthCallbackResult
import com.flashticket.mobile.core.auth.AuthSessionController
import com.flashticket.mobile.core.auth.LocalLogoutResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import net.openid.appauth.AuthState
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.atomic.AtomicInteger

class TokenAuthenticatorUnitTest {

    private class FakeAuthSessionController(
        var currentAccessToken: String? = "old-expired-token",
        var freshTokenAfterRefresh: String? = "new-fresh-token"
    ) : AuthSessionController {
        var logoutCalled = false
        val refreshCallCount = AtomicInteger(0)
        override val isAuthenticated: Boolean get() = currentAccessToken != null
        override val authStateFlow: StateFlow<AuthState?> = MutableStateFlow(null)

        override fun createAuthorizationIntent(): Intent = Intent()
        override suspend fun handleAuthorizationResponse(intent: Intent): Boolean = true
        override suspend fun processAuthorizationResponse(intent: Intent): AuthCallbackResult = AuthCallbackResult.Success
        override suspend fun getValidAccessToken(): String? = refreshAccessToken(null)

        override suspend fun refreshAccessToken(failedToken: String?): String? {
            // Double-checked locking logic: Nếu failedToken đã khác token hiện tại trong state, không refresh lại
            if (!failedToken.isNullOrBlank() && currentAccessToken != null && failedToken != currentAccessToken) {
                return currentAccessToken
            }
            refreshCallCount.incrementAndGet()
            currentAccessToken = freshTokenAfterRefresh
            return currentAccessToken
        }

        override fun createEndSessionIntent(): Intent? = null
        override suspend fun logout(): LocalLogoutResult {
            logoutCalled = true
            currentAccessToken = null
            return LocalLogoutResult()
        }
    }

    @Test
    fun authenticator_whenFreshTokenAvailable_retriesWithNewBearerHeader() {
        val fakeController = FakeAuthSessionController(
            currentAccessToken = "old-expired-token",
            freshTokenAfterRefresh = "new-fresh-token"
        )
        val authenticator = TokenAuthenticator(fakeController)

        val request = Request.Builder()
            .url("http://15.134.248.39/api/users/me")
            .header("Authorization", "Bearer old-expired-token")
            .build()

        val response = Response.Builder()
            .request(request)
            .protocol(Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .build()

        val retryRequest = authenticator.authenticate(null, response)

        assertNotNull(retryRequest)
        assertEquals("Bearer new-fresh-token", retryRequest?.header("Authorization"))
        assertEquals(1, fakeController.refreshCallCount.get())
    }

    @Test
    fun authenticator_doubleCheckedLocking_whenTokenAlreadyUpdatedByOtherRequest_reusesTokenWithoutRefreshingAgain() {
        val fakeController = FakeAuthSessionController(
            currentAccessToken = "already-refreshed-token",
            freshTokenAfterRefresh = "already-refreshed-token"
        )
        val authenticator = TokenAuthenticator(fakeController)

        // Request B đến với token cũ 'old-expired-token' SAU KHI Request A đã cập nhật token thành 'already-refreshed-token'
        val requestB = Request.Builder()
            .url("http://15.134.248.39/api/tickets/my-tickets")
            .header("Authorization", "Bearer old-expired-token")
            .build()

        val responseB = Response.Builder()
            .request(requestB)
            .protocol(Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .build()

        val retryRequestB = authenticator.authenticate(null, responseB)

        assertNotNull(retryRequestB)
        assertEquals("Bearer already-refreshed-token", retryRequestB?.header("Authorization"))
        // Không gọi lại network endpoint lần thứ hai
        assertEquals(0, fakeController.refreshCallCount.get())
    }

    @Test
    fun authenticator_whenFreshTokenIsNull_callsLogoutAndReturnsNull() {
        val fakeController = FakeAuthSessionController(
            currentAccessToken = "old-expired-token",
            freshTokenAfterRefresh = null
        )
        val authenticator = TokenAuthenticator(fakeController)

        val request = Request.Builder()
            .url("http://15.134.248.39/api/users/me")
            .header("Authorization", "Bearer old-expired-token")
            .build()

        val response = Response.Builder()
            .request(request)
            .protocol(Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .build()

        val retryRequest = authenticator.authenticate(null, response)

        assertNull(retryRequest)
        assertTrue(fakeController.logoutCalled)
    }

    @Test
    fun authenticator_whenRetriedMultipleTimes_stopsRetry() {
        val fakeController = FakeAuthSessionController(
            currentAccessToken = "old-expired-token",
            freshTokenAfterRefresh = "new-fresh-token"
        )
        val authenticator = TokenAuthenticator(fakeController)

        val request = Request.Builder()
            .url("http://15.134.248.39/api/users/me")
            .header("Authorization", "Bearer old-expired-token")
            .build()

        val priorResponse1 = Response.Builder()
            .request(request)
            .protocol(Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .build()

        val response2 = Response.Builder()
            .request(request)
            .protocol(Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .priorResponse(priorResponse1)
            .build()

        val retryRequest = authenticator.authenticate(null, response2)
        assertNull(retryRequest)
    }
}
