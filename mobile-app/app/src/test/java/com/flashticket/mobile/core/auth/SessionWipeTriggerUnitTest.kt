package com.flashticket.mobile.core.auth

import com.flashticket.mobile.app.ui.SessionViewModel
import com.flashticket.mobile.core.network.TokenAuthenticator
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import net.openid.appauth.AuthState
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import org.junit.After
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.util.concurrent.atomic.AtomicBoolean

@OptIn(ExperimentalCoroutinesApi::class)
class SessionWipeTriggerUnitTest {

    private val testDispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private class SpyingAuthSessionController(
        private val cleaner: LocalSessionCleaner
    ) : AuthSessionController {
        val logoutInvoked = AtomicBoolean(false)
        override val isAuthenticated: Boolean = true
        override val authStateFlow: StateFlow<AuthState?> = MutableStateFlow(null)

        override fun createAuthorizationIntent(): android.content.Intent = android.content.Intent()
        override suspend fun handleAuthorizationResponse(intent: android.content.Intent): Boolean = true
        override suspend fun processAuthorizationResponse(intent: android.content.Intent): AuthCallbackResult = AuthCallbackResult.Success
        override suspend fun getValidAccessToken(): String? = null
        override suspend fun refreshAccessToken(failedToken: String?): String? = null // Simulates terminal failure
        override fun createEndSessionIntent(): android.content.Intent? = null

        override suspend fun logout(): LocalLogoutResult {
            logoutInvoked.set(true)
            return cleaner.clear()
        }
    }

    private class SpyingTokenStorage : TokenStorage {
        var cleared = false
        override fun saveAuthState(authState: AuthState) = Unit
        override fun readAuthState(): AuthState? = null
        override fun clear() {
            cleared = true
        }
    }

    private class SpyingTicketDao : com.flashticket.mobile.core.database.TicketDao {
        var cleared = false
        override fun getTicketsByUserId(userId: String) = kotlinx.coroutines.flow.emptyFlow<List<com.flashticket.mobile.core.database.TicketEntity>>()
        override suspend fun getUserTicketCount(userId: String): Int = 0
        override suspend fun getTicketCount(): Int = 0
        override suspend fun getTicketById(ticketId: String, userId: String) = null
        override suspend fun insertTickets(tickets: List<com.flashticket.mobile.core.database.TicketEntity>) = Unit
        override suspend fun clearUserTickets(userId: String) = Unit
        override suspend fun clearAll() {
            cleared = true
        }
    }

    private class SpyingCategoryDao : com.flashticket.mobile.core.database.CategoryDao {
        var cleared = false
        override fun getAllCategories() = kotlinx.coroutines.flow.emptyFlow<List<com.flashticket.mobile.core.database.CategoryEntity>>()
        override suspend fun getCategoryCount(): Int = 0
        override suspend fun insertCategories(categories: List<com.flashticket.mobile.core.database.CategoryEntity>) = Unit
        override suspend fun clearAll() {
            cleared = true
        }
    }

    @Test
    fun terminalRefreshFailureInTokenAuthenticator_triggersLogoutAndFullSessionWipe() {
        val tokenStorage = SpyingTokenStorage()
        val ticketDao = SpyingTicketDao()
        val categoryDao = SpyingCategoryDao()
        val cleaner = LocalSessionCleaner(tokenStorage, ticketDao, categoryDao)
        val authController = SpyingAuthSessionController(cleaner)

        val authenticator = TokenAuthenticator(authController)

        val request = Request.Builder()
            .url("http://15.134.248.39/api/users/me")
            .header("Authorization", "Bearer expired-token")
            .build()

        val response = Response.Builder()
            .request(request)
            .protocol(Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .build()

        val retryResult = authenticator.authenticate(null, response)

        assertNull("Authenticator must stop retry on terminal failure", retryResult)
        assertTrue("Logout must be invoked on terminal refresh failure", authController.logoutInvoked.get())
        assertTrue("Token storage must be wiped", tokenStorage.cleared)
        assertTrue("User ticket cache must be wiped", ticketDao.cleared)
        assertTrue("Category cache must be wiped", categoryDao.cleared)
    }

    @Test
    fun sessionViewModelLogout_triggersFullSessionWipe() = runTest {
        val tokenStorage = SpyingTokenStorage()
        val ticketDao = SpyingTicketDao()
        val categoryDao = SpyingCategoryDao()
        val cleaner = LocalSessionCleaner(tokenStorage, ticketDao, categoryDao)
        val authController = SpyingAuthSessionController(cleaner)

        val fakeUserRepo = object : UserRepository {
            override suspend fun getCurrentUserProfile(): Result<com.flashticket.mobile.core.model.UserProfile> {
                return Result.success(com.flashticket.mobile.core.model.UserProfile("u1", "test@test.com", "Test"))
            }
        }

        val viewModel = SessionViewModel(authController, fakeUserRepo)
        advanceUntilIdle()

        viewModel.logout()
        advanceUntilIdle()

        assertTrue("Logout must be invoked from SessionViewModel", authController.logoutInvoked.get())
        assertTrue("Token storage must be wiped", tokenStorage.cleared)
        assertTrue("User ticket cache must be wiped", ticketDao.cleared)
    }
}
