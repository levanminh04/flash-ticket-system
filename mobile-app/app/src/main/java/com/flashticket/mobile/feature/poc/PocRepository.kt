package com.flashticket.mobile.feature.poc

import com.flashticket.mobile.core.database.CategoryDao
import com.flashticket.mobile.core.database.CategoryEntity
import com.flashticket.mobile.core.database.TicketDao
import com.flashticket.mobile.core.database.TicketEntity
import com.flashticket.mobile.core.model.UserProfile
import com.flashticket.mobile.core.network.UserApiService
import com.flashticket.mobile.core.network.toDomain
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

interface PocDataSource {
    suspend fun getCurrentUser(): Result<UserProfile>
    suspend fun getCategoryCount(): Int
    suspend fun getTicketCount(): Int
    suspend fun insertSampleData()
}

/**
 * Technical Debt Note (Gate G0 PoC):
 * Lớp PocRepository được sử dụng độc quyền để kiểm chứng PoC tích hợp kỹ thuật Gate G0.
 * Không được tái sử dụng trực tiếp làm production repository cho Phase P3/P4 khi chưa có Domain Model và Mapper tách biệt.
 */
@Singleton
class PocRepository @Inject constructor(
    private val userApiService: UserApiService,
    private val categoryDao: CategoryDao,
    private val ticketDao: TicketDao
) : PocDataSource {
    override suspend fun getCurrentUser(): Result<UserProfile> = withContext(Dispatchers.IO) {
        try {
            val user = userApiService.getCurrentUser().toDomain()
            Result.success(user)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getCategoryCount(): Int = withContext(Dispatchers.IO) {
        categoryDao.getCategoryCount()
    }

    override suspend fun getTicketCount(): Int = withContext(Dispatchers.IO) {
        ticketDao.getTicketCount()
    }

    override suspend fun insertSampleData() = withContext(Dispatchers.IO) {
        val sampleCat = CategoryEntity(
            id = UUID.randomUUID().toString(),
            name = "Âm nhạc PoC",
            slug = "am-nhac-poc",
            iconUrl = null,
            displayOrder = 1
        )
        val sampleTicket = TicketEntity(
            id = UUID.randomUUID().toString(),
            ticketCode = "TKT-POC-" + UUID.randomUUID().toString().take(6),
            orderId = "ord-poc-1",
            eventId = "ev-poc-1",
            eventTitle = "Sự kiện PoC G0",
            ticketTypeName = "VIP",
            seatLabel = "A-01",
            holderName = "Tester",
            status = "VALID",
            checkedInAt = null,
            userId = "user-poc-1"
        )
        categoryDao.insertCategories(listOf(sampleCat))
        ticketDao.insertTickets(listOf(sampleTicket))
    }

}
