package com.flashticket.mobile.app.ui

import android.content.Intent
import com.flashticket.mobile.core.auth.AuthCallbackResult
import com.flashticket.mobile.core.auth.AuthSessionController
import com.flashticket.mobile.core.auth.LocalLogoutResult
import com.flashticket.mobile.core.auth.UserRepository
import com.flashticket.mobile.core.model.AppError
import com.flashticket.mobile.core.model.UserProfile
import com.flashticket.mobile.core.model.UserRole
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
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SessionViewModelUnitTest {

    private val testDispatcher = StandardTestDispatcher()

    private class FakeAuthSessionController(
        var authenticated: Boolean = false,
        var callbackResult: AuthCallbackResult = AuthCallbackResult.Success
    ) : AuthSessionController {
        override val isAuthenticated: Boolean get() = authenticated
        override val authStateFlow: StateFlow<AuthState?> = MutableStateFlow(null)

        override fun createAuthorizationIntent(): Intent = Intent()
        override suspend fun handleAuthorizationResponse(intent: Intent): Boolean = true
        override suspend fun processAuthorizationResponse(intent: Intent): AuthCallbackResult = callbackResult
        override suspend fun getValidAccessToken(): String? = refreshAccessToken(null)
        override suspend fun refreshAccessToken(failedToken: String?): String? = if (authenticated) "test-token" else null
        override fun createEndSessionIntent(): Intent? = null
        override suspend fun logout(): LocalLogoutResult {
            authenticated = false
            return LocalLogoutResult()
        }
    }

    private class FakeUserRepository(
        var resultToReturn: Result<UserProfile> = Result.success(
            UserProfile(
                id = "user-1",
                email = "user@test.com",
                displayName = "Buyer User",
                roles = listOf("ROLE_BUYER")
            )
        )
    ) : UserRepository {
        override suspend fun getCurrentUserProfile(): Result<UserProfile> = resultToReturn
    }

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun init_whenUnauthenticated_setsUnauthenticatedState() = runTest {
        val authController = FakeAuthSessionController(authenticated = false)
        val userRepo = FakeUserRepository()

        val viewModel = SessionViewModel(authController, userRepo)
        advanceUntilIdle()

        assertEquals(SessionUiState.Unauthenticated, viewModel.uiState.value)
    }

    @Test
    fun init_whenAuthenticated_fetchesProfileAndSetsAuthenticatedState() = runTest {
        val authController = FakeAuthSessionController(authenticated = true)
        val profile = UserProfile(
            id = "user-org",
            email = "org@test.com",
            displayName = "Organizer User",
            roles = listOf("ROLE_ORGANIZER")
        )
        val userRepo = FakeUserRepository(Result.success(profile))

        val viewModel = SessionViewModel(authController, userRepo)
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is SessionUiState.Authenticated)
        val authState = state as SessionUiState.Authenticated
        assertEquals("user-org", authState.userProfile.id)
        assertEquals(UserRole.ORGANIZER, authState.activeRole)
    }

    @Test
    fun handleLoginResult_success_updatesToAuthenticated() = runTest {
        val authController = FakeAuthSessionController(
            authenticated = false,
            callbackResult = AuthCallbackResult.Success
        )
        val profile = UserProfile(
            id = "user-admin",
            email = "admin@test.com",
            displayName = "Admin User",
            roles = listOf("ROLE_ADMIN")
        )
        val userRepo = FakeUserRepository(Result.success(profile))

        val viewModel = SessionViewModel(authController, userRepo)
        advanceUntilIdle()
        assertEquals(SessionUiState.Unauthenticated, viewModel.uiState.value)

        viewModel.handleLoginResult(Intent())
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is SessionUiState.Authenticated)
        assertEquals(UserRole.ADMIN, (state as SessionUiState.Authenticated).activeRole)
    }

    @Test
    fun handleLoginResult_canceled_resetsToUnauthenticated() = runTest {
        val authController = FakeAuthSessionController(
            authenticated = false,
            callbackResult = AuthCallbackResult.Canceled
        )
        val userRepo = FakeUserRepository()

        val viewModel = SessionViewModel(authController, userRepo)
        advanceUntilIdle()

        viewModel.handleLoginResult(Intent())
        advanceUntilIdle()

        assertEquals(SessionUiState.Unauthenticated, viewModel.uiState.value)
    }

    @Test
    fun handleLoginResult_error_setsErrorState() = runTest {
        val authController = FakeAuthSessionController(
            authenticated = false,
            callbackResult = AuthCallbackResult.Error(AppError.AuthError("Access denied"))
        )
        val userRepo = FakeUserRepository()

        val viewModel = SessionViewModel(authController, userRepo)
        advanceUntilIdle()

        viewModel.handleLoginResult(Intent())
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is SessionUiState.Error)
        assertEquals("Access denied", (state as SessionUiState.Error).error.message)
    }

    @Test
    fun switchActiveRole_whenAuthorized_switchesSuccessfully() = runTest {
        val authController = FakeAuthSessionController(authenticated = true)
        val profile = UserProfile(
            id = "user-multi",
            email = "multi@test.com",
            displayName = "Multi User",
            roles = listOf("ROLE_BUYER", "ROLE_ORGANIZER")
        )
        val userRepo = FakeUserRepository(Result.success(profile))

        val viewModel = SessionViewModel(authController, userRepo)
        advanceUntilIdle()

        assertEquals(UserRole.ORGANIZER, (viewModel.uiState.value as SessionUiState.Authenticated).activeRole)

        viewModel.switchActiveRole(UserRole.BUYER)
        assertEquals(UserRole.BUYER, (viewModel.uiState.value as SessionUiState.Authenticated).activeRole)
    }

    @Test
    fun switchActiveRole_pureBuyer_cannotSwitchToOrganizerOrAdmin() = runTest {
        val authController = FakeAuthSessionController(authenticated = true)
        val profile = UserProfile(
            id = "user-buyer",
            email = "buyer@test.com",
            displayName = "Buyer Only",
            roles = listOf("ROLE_BUYER")
        )
        val userRepo = FakeUserRepository(Result.success(profile))

        val viewModel = SessionViewModel(authController, userRepo)
        advanceUntilIdle()

        assertEquals(UserRole.BUYER, (viewModel.uiState.value as SessionUiState.Authenticated).activeRole)

        viewModel.switchActiveRole(UserRole.ORGANIZER)
        assertEquals(UserRole.BUYER, (viewModel.uiState.value as SessionUiState.Authenticated).activeRole)

        viewModel.switchActiveRole(UserRole.ADMIN)
        assertEquals(UserRole.BUYER, (viewModel.uiState.value as SessionUiState.Authenticated).activeRole)
    }

    @Test
    fun switchActiveRole_pureAdminWithoutOrganizerRole_cannotSwitchToOrganizer() = runTest {
        val authController = FakeAuthSessionController(authenticated = true)
        val profile = UserProfile(
            id = "user-admin",
            email = "admin@test.com",
            displayName = "Admin Only",
            roles = listOf("ROLE_ADMIN")
        )
        val userRepo = FakeUserRepository(Result.success(profile))

        val viewModel = SessionViewModel(authController, userRepo)
        advanceUntilIdle()

        assertEquals(UserRole.ADMIN, (viewModel.uiState.value as SessionUiState.Authenticated).activeRole)

        viewModel.switchActiveRole(UserRole.ORGANIZER)
        // Must remain ADMIN because user does not have ORGANIZER role in profile.roles
        assertEquals(UserRole.ADMIN, (viewModel.uiState.value as SessionUiState.Authenticated).activeRole)
    }

    @Test
    fun logout_clearsSessionAndSetsUnauthenticated() = runTest {
        val authController = FakeAuthSessionController(authenticated = true)
        val userRepo = FakeUserRepository()

        val viewModel = SessionViewModel(authController, userRepo)
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value is SessionUiState.Authenticated)

        viewModel.logout()
        advanceUntilIdle()

        assertEquals(SessionUiState.Unauthenticated, viewModel.uiState.value)
    }
}
