package com.flashticket.mobile.core.datastore

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

@OptIn(ExperimentalCoroutinesApi::class)
class AppPreferencesDataSourceUnitTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    @Test
    fun lastSelectedCategory_savesAndRetrievesReactiveFlow() = runTest {
        val testDataStore = PreferenceDataStoreFactory.create(
            scope = CoroutineScope(Dispatchers.IO + SupervisorJob()),
            produceFile = { tempFolder.newFile("test_user_prefs.preferences_pb") }
        )
        val dataSource = AppPreferencesDataSource(testDataStore)

        assertNull(dataSource.lastSelectedCategoryIdFlow.first())

        dataSource.setLastSelectedCategoryId("cat-music")
        assertEquals("cat-music", dataSource.lastSelectedCategoryIdFlow.first())

        dataSource.setLastSelectedCategoryId(null)
        assertNull(dataSource.lastSelectedCategoryIdFlow.first())
    }

    @Test
    fun darkModeAndSyncTime_savesAndClearsProperly() = runTest {
        val testDataStore = PreferenceDataStoreFactory.create(
            scope = CoroutineScope(Dispatchers.IO + SupervisorJob()),
            produceFile = { tempFolder.newFile("test_user_prefs_2.preferences_pb") }
        )
        val dataSource = AppPreferencesDataSource(testDataStore)

        assertFalse(dataSource.isDarkModeEnabledFlow.first())
        assertEquals(0L, dataSource.lastSyncTimestampFlow.first())

        dataSource.setDarkModeEnabled(true)
        dataSource.setLastSyncTimestamp(1700000000L)

        assertTrue(dataSource.isDarkModeEnabledFlow.first())
        assertEquals(1700000000L, dataSource.lastSyncTimestampFlow.first())

        dataSource.clear()

        assertFalse(dataSource.isDarkModeEnabledFlow.first())
        assertEquals(0L, dataSource.lastSyncTimestampFlow.first())
    }
}
