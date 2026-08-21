package com.flashticket.mobile.core.auth

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.flashticket.mobile.BuildConfig
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
import org.json.JSONException
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

interface TokenStorage {
    fun saveAuthState(authState: AuthState)
    fun readAuthState(): AuthState?
    fun clear()
}

interface AuthSessionController {
    val isAuthenticated: Boolean
    fun createAuthorizationIntent(): Intent
    suspend fun handleAuthorizationResponse(intent: Intent): Boolean
    suspend fun getValidAccessToken(): String?
    fun createEndSessionIntent(): Intent?
    suspend fun logout(): LocalLogoutResult
}

@Singleton
class EncryptedTokenStorage @Inject constructor(
    @ApplicationContext private val context: Context
) : TokenStorage {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val sharedPreferences = EncryptedSharedPreferences.create(
        context,
        "flash_ticket_secure_session",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    override fun saveAuthState(authState: AuthState) {
        sharedPreferences.edit()
            .putString("auth_state_json", authState.jsonSerializeString())
            .apply()
    }

    override fun readAuthState(): AuthState? {
        val json = sharedPreferences.getString("auth_state_json", null) ?: return null
        return try {
            AuthState.jsonDeserialize(json)
        } catch (e: JSONException) {
            null
        }
    }

    override fun clear() {
        check(sharedPreferences.edit().clear().commit()) {
            "Không thể xóa session cục bộ"
        }
    }
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
    val authStateFlow: StateFlow<AuthState?> = _authStateFlow.asStateFlow()

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
            Uri.parse("com.flashticket.mobile:/oauth2redirect")
        )
            .setScopes("openid", "profile", "email")
            .setCodeVerifier(CodeVerifierUtil.generateRandomCodeVerifier())
            .build()

        return authService.getAuthorizationRequestIntent(authRequest)
    }

    /**
     * Xử lý callback từ Custom Tabs, đổi Authorization Code lấy Token
     */
    override suspend fun handleAuthorizationResponse(intent: Intent): Boolean = withContext(Dispatchers.IO) {
        val response = AuthorizationResponse.fromIntent(intent)
        val exception = AuthorizationException.fromIntent(intent)

        if (response != null) {
            val authState = _authStateFlow.value ?: AuthState(response.request.configuration)
            authState.update(response, exception)

            val tokenExchangeRequest = response.createTokenExchangeRequest()
            suspendCancellableCoroutine { continuation ->
                authService.performTokenRequest(tokenExchangeRequest) { tokenResponse, tokenEx ->
                    authState.update(tokenResponse, tokenEx)
                    if (tokenResponse != null) {
                        updateAuthState(authState)
                        continuation.resume(true)
                    } else {
                        continuation.resume(false)
                    }
                }
            }
        } else {
            false
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

    /**
     * Lấy Access Token hợp lệ, tự động refresh qua AppAuth nếu token đã hoặc sắp hết hạn.
     */
    override suspend fun getValidAccessToken(): String? = withContext(Dispatchers.IO) {
        val currentState = _authStateFlow.value ?: return@withContext null
        if (!currentState.isAuthorized) return@withContext null

        refreshMutex.withLock {
            suspendCancellableCoroutine { continuation ->
                currentState.performActionWithFreshTokens(authService) { accessToken, _, ex ->
                    if (ex != null) {
                        continuation.resume(null)
                    } else {
                        updateAuthState(currentState)
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
            .setPostLogoutRedirectUri(Uri.parse("com.flashticket.mobile:/oauth2redirect"))
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
