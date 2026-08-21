package com.flashticket.mobile.core.auth

import com.flashticket.mobile.core.database.CategoryDao
import com.flashticket.mobile.core.database.CategoryEntity
import com.flashticket.mobile.core.database.TicketDao
import com.flashticket.mobile.core.database.TicketEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.test.runTest
import net.openid.appauth.AuthState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

private class RecordingTokenStorage : TokenStorage {
    var clearCount = 0
    var failure: Exception? = null

    override fun saveAuthState(authState: AuthState) = Unit
    override fun readAuthState(): AuthState? = null
    override fun clear() {
        clearCount++
        failure?.let { throw it }
    }
}

private class RecordingCategoryDao : CategoryDao {
    var clearCount = 0
    var failure: Exception? = null

    override fun getAllCategories(): Flow<List<CategoryEntity>> = emptyFlow()
    override suspend fun getCategoryCount(): Int = 0
    override suspend fun insertCategories(categories: List<CategoryEntity>) = Unit
    override suspend fun clearAll() {
        clearCount++
        failure?.let { throw it }
    }
}

private class RecordingTicketDao : TicketDao {
    var clearCount = 0
    var failure: Exception? = null

    override fun getTicketsByUserId(userId: String): Flow<List<TicketEntity>> = emptyFlow()
    override suspend fun getTicketCount(): Int = 0
    override suspend fun getTicketById(ticketId: String): TicketEntity? = null
    override suspend fun insertTickets(tickets: List<TicketEntity>) = Unit
    override suspend fun clearUserTickets(userId: String) = Unit
    override suspend fun clearAll() {
        clearCount++
        failure?.let { throw it }
    }
}

class LocalSessionCleanerUnitTest {
    private val tokenStorage = RecordingTokenStorage()
    private val ticketDao = RecordingTicketDao()
    private val categoryDao = RecordingCategoryDao()
    private val cleaner = LocalSessionCleaner(tokenStorage, ticketDao, categoryDao)

    @Test
    fun clear_attemptsEveryStoreAndReportsSuccess() = runTest {
        val result = cleaner.clear()

        assertTrue(result.isComplete)
        assertEquals(1, tokenStorage.clearCount)
        assertEquals(1, ticketDao.clearCount)
        assertEquals(1, categoryDao.clearCount)
    }

    @Test
    fun clear_whenTokenStorageFails_stillClearsRoomAndReportsFailure() = runTest {
        tokenStorage.failure = IllegalStateException("token clear failed")

        val result = cleaner.clear()

        assertEquals(setOf(LocalSessionData.AUTH_STATE), result.failedData)
        assertEquals(1, ticketDao.clearCount)
        assertEquals(1, categoryDao.clearCount)
    }

    @Test
    fun clear_whenTicketWipeFails_stillClearsCategoriesAndReportsFailure() = runTest {
        ticketDao.failure = IllegalStateException("ticket clear failed")

        val result = cleaner.clear()

        assertEquals(setOf(LocalSessionData.TICKETS), result.failedData)
        assertEquals(1, tokenStorage.clearCount)
        assertEquals(1, categoryDao.clearCount)
    }

    @Test
    fun clear_whenCancellationOccurs_doesNotSwallowCancellation() = runTest {
        tokenStorage.failure = CancellationException("cancelled")
        var cancellationRethrown = false

        try {
            cleaner.clear()
        } catch (exception: CancellationException) {
            cancellationRethrown = true
        }

        assertTrue(cancellationRethrown)
        assertEquals(0, ticketDao.clearCount)
        assertEquals(0, categoryDao.clearCount)
    }
}
