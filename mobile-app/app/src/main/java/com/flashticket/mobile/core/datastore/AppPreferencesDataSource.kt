package com.flashticket.mobile.core.datastore

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Quản lý preferences cấu hình không nhạy cảm sử dụng Jetpack Preferences DataStore (theo ADR-006 & P3.3).
 * Tuyệt đối không lưu token/credential trong DataStore này (token do KeystoreTokenStorage quản lý).
 */
@Singleton
class AppPreferencesDataSource @Inject constructor(
    private val dataStore: DataStore<Preferences>
) {
    companion object {
        private val KEY_LAST_CATEGORY_ID = stringPreferencesKey("last_selected_category_id")
        private val KEY_DARK_MODE = booleanPreferencesKey("dark_mode_enabled")
        private val KEY_LAST_SYNC_TIME = longPreferencesKey("last_discovery_sync_timestamp")
    }

    val lastSelectedCategoryIdFlow: Flow<String?> = dataStore.data
        .catch { exception ->
            if (exception is IOException) {
                emit(emptyPreferences())
            } else {
                throw exception
            }
        }
        .map { preferences ->
            preferences[KEY_LAST_CATEGORY_ID]
        }

    val isDarkModeEnabledFlow: Flow<Boolean> = dataStore.data
        .catch { exception ->
            if (exception is IOException) {
                emit(emptyPreferences())
            } else {
                throw exception
            }
        }
        .map { preferences ->
            preferences[KEY_DARK_MODE] ?: false
        }

    val lastSyncTimestampFlow: Flow<Long> = dataStore.data
        .catch { exception ->
            if (exception is IOException) {
                emit(emptyPreferences())
            } else {
                throw exception
            }
        }
        .map { preferences ->
            preferences[KEY_LAST_SYNC_TIME] ?: 0L
        }

    suspend fun setLastSelectedCategoryId(categoryId: String?) {
        dataStore.edit { preferences ->
            if (categoryId != null) {
                preferences[KEY_LAST_CATEGORY_ID] = categoryId
            } else {
                preferences.remove(KEY_LAST_CATEGORY_ID)
            }
        }
    }

    suspend fun setDarkModeEnabled(enabled: Boolean) {
        dataStore.edit { preferences ->
            preferences[KEY_DARK_MODE] = enabled
        }
    }

    suspend fun setLastSyncTimestamp(timestamp: Long) {
        dataStore.edit { preferences ->
            preferences[KEY_LAST_SYNC_TIME] = timestamp
        }
    }

    suspend fun clear() {
        dataStore.edit { preferences ->
            preferences.clear()
        }
    }
}
