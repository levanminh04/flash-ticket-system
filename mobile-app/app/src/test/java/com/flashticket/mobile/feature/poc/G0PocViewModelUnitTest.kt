package com.flashticket.mobile.feature.poc

import android.content.Intent
import com.flashticket.mobile.core.auth.AuthSessionController
import com.flashticket.mobile.core.auth.LocalLogoutResult
import com.flashticket.mobile.core.auth.LocalSessionData
import com.flashticket.mobile.core.model.UserProfile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

private class FakeAuthSessionController : AuthSessionController {
    override var isAuthenticated: Boolean = false
    var accessToken: String? = null
    var logoutCalled = false
    var logoutResult = LocalLogoutResult()

    override fun createAuthorizationIntent(): Intent = error("Not used by this test")
    override suspend fun handleAuthorizationResponse(intent: Intent): Boolean = false
    override suspend fun getValidAccessToken(): String? = accessToken
    override fun createEndSessionIntent(): Intent? = null
    override suspend fun logout(): LocalLogoutResult {
        logoutCalled = true
        isAuthenticated = false
        accessToken = null
        return logoutResult
    }
}

private class FakePocDataSource : PocDataSource {
    var currentUserResult: Result<UserProfile> = Result.failure(IllegalStateException("No user"))

    override suspend fun getCurrentUser(): Result<UserProfile> = currentUserResult
    override suspend fun getCategoryCount(): Int = 0
    override suspend fun getTicketCount(): Int = 0
    override suspend fun insertSampleData() = Unit
}

@OptIn(ExperimentalCoroutinesApi::class)
class G0PocViewModelUnitTest {
    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun buyerProfile_cannotActivateScanner() = runTest(dispatcher) {
        val dataSource = FakePocDataSource().apply {
            currentUserResult = Result.success(userWithRole("BUYER"))
        }
        val viewModel = G0PocViewModel(FakeAuthSessionController(), dataSource)

        viewModel.testCallApi07()
        advanceUntilIdle()
        viewModel.toggleScanner(true)

        assertFalse(viewModel.uiState.value.isOrganizer)
        assertFalse(viewModel.uiState.value.isScannerActive)
    }

    @Test
    fun organizerProfile_canActivateScanner() = runTest(dispatcher) {
        val dataSource = FakePocDataSource().apply {
            currentUserResult = Result.success(userWithRole("ROLE_ORGANIZER"))
        }
        val viewModel = G0PocViewModel(FakeAuthSessionController(), dataSource)

        viewModel.testCallApi07()
        advanceUntilIdle()
        viewModel.toggleScanner(true)

        assertTrue(viewModel.uiState.value.isOrganizer)
        assertTrue(viewModel.uiState.value.isScannerActive)
    }

    @Test
    fun beginLogout_wipesLocallyBeforeRequestingRemoteEndSession() = runTest(dispatcher) {
        val auth = FakeAuthSessionController().apply {
            isAuthenticated = true
            accessToken = "test-token-not-logged"
        }
        val viewModel = G0PocViewModel(auth, FakePocDataSource())
        var callbackObservedLocalWipe = false

        viewModel.beginLogout {
            callbackObservedLocalWipe = auth.logoutCalled && !viewModel.uiState.value.isAuthenticated
        }
        advanceUntilIdle()

        assertTrue(auth.logoutCalled)
        assertTrue(callbackObservedLocalWipe)
        assertFalse(viewModel.uiState.value.hasAccessToken)
    }

    @Test
    fun remoteEndSessionReturn_doesNotHidePartialLocalWipeFailure() = runTest(dispatcher) {
        val auth = FakeAuthSessionController().apply {
            logoutResult = LocalLogoutResult(setOf(LocalSessionData.AUTH_STATE))
        }
        val viewModel = G0PocViewModel(auth, FakePocDataSource())

        viewModel.beginLogout { viewModel.onRemoteEndSessionReturned() }
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value.hasLocalWipeFailure)
        assertTrue(viewModel.uiState.value.statusMessage.contains("chưa xóa hết dữ liệu cục bộ"))
    }

    private fun userWithRole(role: String) = UserProfile(
        id = "test-user-id",
        email = "user@example.invalid",
        displayName = "Test User",
        roles = listOf(role)
    )
}
