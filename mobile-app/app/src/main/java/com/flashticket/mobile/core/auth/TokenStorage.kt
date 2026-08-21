package com.flashticket.mobile.core.auth

import android.content.Context
import android.content.Intent
import android.net.Uri
import com.flashticket.mobile.BuildConfig
import com.flashticket.mobile.core.model.AppError
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import net.openid.appauth.*
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

interface TokenStorage {
    fun saveAuthState(authState: AuthState)
    fun readAuthState(): AuthState?
    fun clear()
}

sealed interface AuthCallbackResult {
    data object Success : AuthCallbackResult
    data object Canceled : AuthCallbackResult
    data class Error(val error: AppError) : AuthCallbackResult
}

interface AuthSessionController {
    val isAuthenticated: Boolean
    val authStateFlow: StateFlow<AuthState?>
    fun createAuthorizationIntent(): Intent
    suspend fun handleAuthorizationResponse(intent: Intent): Boolean
    suspend fun processAuthorizationResponse(intent: Intent): AuthCallbackResult
    suspend fun getValidAccessToken(): String?
    suspend fun refreshAccessToken(failedToken: String? = null): String?
    fun createEndSessionIntent(): Intent?
    suspend fun logout(): LocalLogoutResult
}

@Singleton
class AuthManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val tokenStorage: TokenStorage,
    private val localSessionCleaner: LocalSessionCleaner
) : AuthSessionController {

    private val appAuthConfiguration = AppAuthConfiguration.Builder()
        .setConnectionBuilder(RestrictedConnectionBuilder(BuildConfig.ALLOWED_CLEARTEXT_HOST))
        .setSkipIssuerHttpsCheck(BuildConfig.KEYCLOAK_ISSUER_URL.startsWith("http://"))
        .build()

    private val authService = AuthorizationService(context, appAuthConfiguration)
    private val refreshMutex = Mutex()
    private val _authStateFlow = MutableStateFlow<AuthState?>(tokenStorage.readAuthState())
    override val authStateFlow: StateFlow<AuthState?> = _authStateFlow.asStateFlow()

    override val isAuthenticated: Boolean
        get() = _authStateFlow.value?.isAuthorized == true

    private val serviceConfiguration = AuthorizationServiceConfiguration(
        Uri.parse("${BuildConfig.KEYCLOAK_ISSUER_URL}/protocol/openid-connect/auth"),
        Uri.parse("${BuildConfig.KEYCLOAK_ISSUER_URL}/protocol/openid-connect/token"),
        null,
        Uri.parse("${BuildConfig.KEYCLOAK_ISSUER_URL}/protocol/openid-connect/logout")
    )

    /**
     * Tạo Intent mở Browser đăng nhập OAuth 2.0 / OIDC với PKCE S256
     */
    override fun createAuthorizationIntent(): Intent {
        val authRequest = AuthorizationRequest.Builder(
            serviceConfiguration,
            BuildConfig.KEYCLOAK_CLIENT_ID,
            ResponseTypeValues.CODE,
            Uri.parse(BuildConfig.REDIRECT_URI)
        )
            .setScopes("openid", "profile", "email")
            .setCodeVerifier(CodeVerifierUtil.generateRandomCodeVerifier())
            .build()

        return authService.getAuthorizationRequestIntent(authRequest)
    }

    /**
     * Xử lý callback từ Custom Tabs trả về boolean
     */
    override suspend fun handleAuthorizationResponse(intent: Intent): Boolean {
        return processAuthorizationResponse(intent) is AuthCallbackResult.Success
    }

    /**
     * Xử lý callback từ Custom Tabs với chi tiết kết quả (Success, Canceled, Error)
     */
    override suspend fun processAuthorizationResponse(intent: Intent): AuthCallbackResult = withContext(Dispatchers.IO) {
        val response = AuthorizationResponse.fromIntent(intent)
        val exception = AuthorizationException.fromIntent(intent)

        if (exception != null) {
            if (exception.type == AuthorizationException.TYPE_GENERAL_ERROR &&
                exception.code == AuthorizationException.GeneralErrors.USER_CANCELED_AUTH_FLOW.code
            ) {
                return@withContext AuthCallbackResult.Canceled
            }
            return@withContext AuthCallbackResult.Error(
                AppError.AuthError(
                    message = exception.errorDescription ?: exception.message ?: "Authentication failed",
                    cause = exception
                )
            )
        }

        if (response != null) {
            val authState = _authStateFlow.value ?: AuthState(response.request.configuration)
            authState.update(response, null)

            val tokenExchangeRequest = response.createTokenExchangeRequest()
            suspendCancellableCoroutine<AuthCallbackResult> { continuation ->
                authService.performTokenRequest(tokenExchangeRequest) { tokenResponse, tokenEx ->
                    authState.update(tokenResponse, tokenEx)
                    if (tokenResponse != null) {
                        updateAuthState(authState)
                        continuation.resume(AuthCallbackResult.Success)
                    } else {
                        continuation.resume(
                            AuthCallbackResult.Error(
                                AppError.AuthError(
                                    message = tokenEx?.errorDescription ?: tokenEx?.message ?: "Token exchange failed",
                                    cause = tokenEx
                                )
                            )
                        )
                    }
                }
            }
        } else {
            AuthCallbackResult.Error(AppError.AuthError("No authorization response or exception in callback intent"))
        }
    }

    fun updateAuthState(authState: AuthState?) {
        if (authState != null) {
            tokenStorage.saveAuthState(authState)
        } else {
            tokenStorage.clear()
        }
        _authStateFlow.value = authState
    }

    override suspend fun getValidAccessToken(): String? = refreshAccessToken(null)

    /**
     * Single-flight token refresh với cơ chế double-checked locking:
     * Nếu một request đồng thời khác đã refresh token thành công trong khi coroutine này đang chờ Mutex,
     * trả về ngay token mới mà không gọi lại Keycloak endpoint.
     */
    override suspend fun refreshAccessToken(failedToken: String?): String? = withContext(Dispatchers.IO) {
        val currentState = _authStateFlow.value ?: return@withContext null
        if (!currentState.isAuthorized) return@withContext null

        refreshMutex.withLock {
            val latestState = _authStateFlow.value ?: return@withLock null
            val latestToken = latestState.accessToken

            // Double check: Nếu token hiện tại đã được refresh và khác failedToken, trả về token mới ngay lập tức
            if (!failedToken.isNullOrBlank() && !latestToken.isNullOrBlank() && latestToken != failedToken && latestState.isAuthorized) {
                return@withLock latestToken
            }

            suspendCancellableCoroutine<String?> { continuation ->
                latestState.performActionWithFreshTokens(authService) { accessToken, _, ex ->
                    if (ex != null) {
                        continuation.resume(null)
                    } else {
                        updateAuthState(latestState)
                        continuation.resume(accessToken)
                    }
                }
            }
        }
    }

    /**
     * Tạo Intent Đăng xuất OIDC End-Session (Browser logout)
     */
    override fun createEndSessionIntent(): Intent? {
        val idToken = _authStateFlow.value?.idToken ?: return null
        val endSessionRequest = EndSessionRequest.Builder(serviceConfiguration)
            .setIdTokenHint(idToken)
            .setPostLogoutRedirectUri(Uri.parse(BuildConfig.REDIRECT_URI))
            .build()
        return authService.getEndSessionRequestIntent(endSessionRequest)
    }

    /**
     * Xóa session cục bộ độc lập với OIDC end-session và trả về vùng dữ liệu chưa xóa được, nếu có.
     */
    override suspend fun logout(): LocalLogoutResult = withContext(NonCancellable + Dispatchers.IO) {
        _authStateFlow.value = null
        localSessionCleaner.clear()
    }

    fun dispose() {
        authService.dispose()
    }
}
