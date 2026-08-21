package com.flashticket.mobile.core.database

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "categories")
data class CategoryEntity(
    @PrimaryKey val id: String,
    val name: String,
    val slug: String,
    val iconUrl: String? = null,
    val displayOrder: Int = 0,
    val cachedAt: Long = System.currentTimeMillis()
)

@Entity(tableName = "tickets")
data class TicketEntity(
    @PrimaryKey val id: String,
    val ticketCode: String,
    val orderId: String,
    val eventId: String,
    val eventTitle: String,
    val ticketTypeName: String,
    val seatLabel: String? = null,
    val holderName: String,
    val status: String,
    val checkedInAt: String? = null,
    val userId: String,
    val cachedAt: Long = System.currentTimeMillis()
)

@Dao
interface CategoryDao {
    @Query("SELECT * FROM categories ORDER BY displayOrder ASC")
    fun getAllCategories(): Flow<List<CategoryEntity>>

    @Query("SELECT COUNT(*) FROM categories")
    suspend fun getCategoryCount(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCategories(categories: List<CategoryEntity>)

    @Query("DELETE FROM categories")
    suspend fun clearAll()

    @Transaction
    suspend fun replaceAll(categories: List<CategoryEntity>) {
        clearAll()
        insertCategories(categories)
    }
}

@Dao
interface TicketDao {
    @Query("SELECT * FROM tickets WHERE userId = :userId ORDER BY cachedAt DESC")
    fun getTicketsByUserId(userId: String): Flow<List<TicketEntity>>

    @Query("SELECT COUNT(*) FROM tickets WHERE userId = :userId")
    suspend fun getUserTicketCount(userId: String): Int

    @Query("SELECT COUNT(*) FROM tickets")
    suspend fun getTicketCount(): Int

    @Query("SELECT * FROM tickets WHERE id = :ticketId AND userId = :userId")
    suspend fun getTicketById(ticketId: String, userId: String): TicketEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTickets(tickets: List<TicketEntity>)

    @Query("DELETE FROM tickets WHERE userId = :userId")
    suspend fun clearUserTickets(userId: String)

    @Query("DELETE FROM tickets")
    suspend fun clearAll()
}

@Database(
    entities = [
        CategoryEntity::class,
        TicketEntity::class
    ],
    version = 1,
    exportSchema = true
)
abstract class FlashTicketDatabase : RoomDatabase() {
    abstract fun categoryDao(): CategoryDao
    abstract fun ticketDao(): TicketDao

    companion object {
        const val DATABASE_NAME = "flash_ticket_android.db"
    }
}
