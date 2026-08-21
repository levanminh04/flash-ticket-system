package com.flashticket.mobile.core.auth

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import dagger.hilt.android.qualifiers.ApplicationContext
import net.openid.appauth.AuthState
import org.json.JSONException
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Triển khai TokenStorage sử dụng Android Keystore trực tiếp với thuật toán AES-256 GCM (theo ADR-005).
 * Thay thế EncryptedSharedPreferences/MasterKey đã deprecated.
 * Ciphertext và IV được lưu trong app-private SharedPreferences "flash_ticket_keystore_session".
 */
@Singleton
class KeystoreTokenStorage @Inject constructor(
    @ApplicationContext private val context: Context
) : TokenStorage {

    companion object {
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val KEY_ALIAS = "flash_ticket_keystore_master_key"
        private const val PREFS_NAME = "flash_ticket_keystore_session"
        private const val KEY_CIPHERTEXT = "encrypted_auth_state_blob"
        private const val KEY_IV = "auth_state_iv"
        private const val TRANSFORMATION = "AES/GCM/NoPadding"
        private const val GCM_TAG_LENGTH_BITS = 128
    }

    private val sharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun getOrCreateSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
        if (keyStore.containsAlias(KEY_ALIAS)) {
            val entry = keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry
            if (entry != null) {
                return entry.secretKey
            }
        }

        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()

        keyGenerator.init(spec)
        return keyGenerator.generateKey()
    }

    override fun saveAuthState(authState: AuthState) {
        try {
            val rawJson = authState.jsonSerializeString()
            val secretKey = getOrCreateSecretKey()

            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, secretKey)
            val iv = cipher.iv
            val encryptedBytes = cipher.doFinal(rawJson.toByteArray(Charsets.UTF_8))

            val ivBase64 = Base64.encodeToString(iv, Base64.NO_WRAP)
            val ciphertextBase64 = Base64.encodeToString(encryptedBytes, Base64.NO_WRAP)

            sharedPreferences.edit()
                .putString(KEY_IV, ivBase64)
                .putString(KEY_CIPHERTEXT, ciphertextBase64)
                .apply()
        } catch (e: Exception) {
            // Khi có lỗi mã hóa, xóa session để đảm bảo an toàn
            clear()
        }
    }

    override fun readAuthState(): AuthState? {
        val ivBase64 = sharedPreferences.getString(KEY_IV, null) ?: return null
        val ciphertextBase64 = sharedPreferences.getString(KEY_CIPHERTEXT, null) ?: return null

        return try {
            val iv = Base64.decode(ivBase64, Base64.NO_WRAP)
            val encryptedBytes = Base64.decode(ciphertextBase64, Base64.NO_WRAP)
            val secretKey = getOrCreateSecretKey()

            val cipher = Cipher.getInstance(TRANSFORMATION)
            val gcmSpec = GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv)
            cipher.init(Cipher.DECRYPT_MODE, secretKey, gcmSpec)

            val decryptedBytes = cipher.doFinal(encryptedBytes)
            val rawJson = String(decryptedBytes, Charsets.UTF_8)
            AuthState.jsonDeserialize(rawJson)
        } catch (e: Exception) {
            // Key invalidated, dữ liệu corrupt hoặc decrypt lỗi -> Xóa an toàn và yêu cầu login lại theo ADR-005
            clear()
            null
        }
    }

    override fun clear() {
        sharedPreferences.edit().clear().commit()
    }
}
