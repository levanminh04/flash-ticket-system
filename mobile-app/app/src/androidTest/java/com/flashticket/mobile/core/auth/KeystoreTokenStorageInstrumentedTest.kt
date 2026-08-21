package com.flashticket.mobile.core.auth

import android.content.Context
import android.net.Uri
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import net.openid.appauth.AuthState
import net.openid.appauth.AuthorizationRequest
import net.openid.appauth.AuthorizationResponse
import net.openid.appauth.AuthorizationServiceConfiguration
import net.openid.appauth.ResponseTypeValues
import net.openid.appauth.TokenResponse
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.security.KeyStore

@RunWith(AndroidJUnit4::class)
class KeystoreTokenStorageInstrumentedTest {

    private lateinit var context: Context
    private lateinit var storage: KeystoreTokenStorage

    private val serviceConfig = AuthorizationServiceConfiguration(
        Uri.parse("http://15.134.248.39/auth/realms/flash-ticket/protocol/openid-connect/auth"),
        Uri.parse("http://15.134.248.39/auth/realms/flash-ticket/protocol/openid-connect/token")
    )

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        storage = KeystoreTokenStorage(context)
        storage.clear()
    }

    @After
    fun tearDown() {
        storage.clear()
    }

    private fun createSampleAuthState(): AuthState {
        val authReq = AuthorizationRequest.Builder(
            serviceConfig,
            "flash-ticket-android",
            ResponseTypeValues.CODE,
            Uri.parse("com.flashticket.mobile:/oauth2redirect")
        ).build()

        val authResp = AuthorizationResponse.Builder(authReq)
            .setAuthorizationCode("sample-code-123")
            .build()

        val tokenResp = TokenResponse.Builder(authResp.createTokenExchangeRequest())
            .setAccessToken("sample-access-token-xyz")
            .setRefreshToken("sample-refresh-token-abc")
            .setIdToken("sample-id-token-789")
            .setTokenType("Bearer")
            .setAccessTokenExpiresIn(3600L)
            .build()

        val authState = AuthState(serviceConfig)
        authState.update(authResp, null)
        authState.update(tokenResp, null)
        return authState
    }

    @Test
    fun saveAuthState_then_recreateStorage_readsCorrectAuthState() {
        val original = createSampleAuthState()
        storage.saveAuthState(original)

        // Khởi tạo một instance KeystoreTokenStorage mới để mô phỏng app restart
        val newStorageInstance = KeystoreTokenStorage(context)
        val restored = newStorageInstance.readAuthState()

        assertNotNull("Restored AuthState must not be null", restored)
        assertEquals(original.accessToken, restored?.accessToken)
        assertEquals(original.refreshToken, restored?.refreshToken)
        assertEquals(original.idToken, restored?.idToken)
        assertEquals(original.isAuthorized, restored?.isAuthorized)
    }

    @Test
    fun corruptedCiphertext_returnsNull_and_clearsSafelyWithoutCrash() {
        val original = createSampleAuthState()
        storage.saveAuthState(original)

        // Làm hỏng dữ liệu ciphertext trong SharedPreferences
        val prefs = context.getSharedPreferences("flash_ticket_keystore_session", Context.MODE_PRIVATE)
        prefs.edit().putString("encrypted_auth_state_blob", "corrupted_garbage_base64_payload").commit()

        val restored = storage.readAuthState()
        assertNull("Restored AuthState must be null when ciphertext is corrupted", restored)

        // Đảm bảo dữ liệu đã được dọn sạch an toàn
        val ciphertextAfter = prefs.getString("encrypted_auth_state_blob", null)
        assertNull(ciphertextAfter)
    }

    @Test
    fun missingIv_returnsNull_withoutCrash() {
        val original = createSampleAuthState()
        storage.saveAuthState(original)

        // Xóa IV khỏi SharedPreferences
        val prefs = context.getSharedPreferences("flash_ticket_keystore_session", Context.MODE_PRIVATE)
        prefs.edit().remove("auth_state_iv").commit()

        val restored = storage.readAuthState()
        assertNull("Restored AuthState must be null when IV is missing", restored)
    }

    @Test
    fun deletedKeystoreKey_clearsStorageAndReturnsNullWithoutCrash() {
        val original = createSampleAuthState()
        storage.saveAuthState(original)

        // Xóa Key alias khỏi AndroidKeyStore để mô phỏng key bị invalidated hoặc xóa
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        if (keyStore.containsAlias("flash_ticket_keystore_master_key")) {
            keyStore.deleteEntry("flash_ticket_keystore_master_key")
        }

        val restored = storage.readAuthState()
        assertNull("Restored AuthState must be null when master key is deleted/invalidated", restored)
    }

    @Test
    fun clear_wipesEncryptedDataCompletely() {
        val original = createSampleAuthState()
        storage.saveAuthState(original)

        storage.clear()

        val prefs = context.getSharedPreferences("flash_ticket_keystore_session", Context.MODE_PRIVATE)
        assertNull(prefs.getString("encrypted_auth_state_blob", null))
        assertNull(prefs.getString("auth_state_iv", null))
        assertNull(storage.readAuthState())
    }
}
