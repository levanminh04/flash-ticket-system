package com.flashticket.mobile.core.auth

import com.flashticket.mobile.core.database.CategoryDao
import com.flashticket.mobile.core.database.TicketDao
import kotlinx.coroutines.CancellationException
import javax.inject.Inject
import javax.inject.Singleton

enum class LocalSessionData { AUTH_STATE, TICKETS, CATEGORIES }

data class LocalLogoutResult(
    val failedData: Set<LocalSessionData> = emptySet()
) {
    val isComplete: Boolean
        get() = failedData.isEmpty()
}

@Singleton
class LocalSessionCleaner @Inject constructor(
    private val tokenStorage: TokenStorage,
    private val ticketDao: TicketDao,
    private val categoryDao: CategoryDao
) {
    suspend fun clear(): LocalLogoutResult {
        val failures = linkedSetOf<LocalSessionData>()
        clearStep(LocalSessionData.AUTH_STATE, failures) { tokenStorage.clear() }
        clearStep(LocalSessionData.TICKETS, failures) { ticketDao.clearAll() }
        clearStep(LocalSessionData.CATEGORIES, failures) { categoryDao.clearAll() }
        return LocalLogoutResult(failures)
    }

    private suspend fun clearStep(
        data: LocalSessionData,
        failures: MutableSet<LocalSessionData>,
        action: suspend () -> Unit
    ) {
        try {
            action()
        } catch (exception: CancellationException) {
            throw exception
        } catch (exception: Exception) {
            failures += data
        }
    }
}
