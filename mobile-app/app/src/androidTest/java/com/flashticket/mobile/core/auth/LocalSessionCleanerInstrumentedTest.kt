package com.flashticket.mobile.core.auth

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.flashticket.mobile.core.database.CategoryEntity
import com.flashticket.mobile.core.database.FlashTicketDatabase
import com.flashticket.mobile.core.database.TicketEntity
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LocalSessionCleanerInstrumentedTest {

    private lateinit var database: FlashTicketDatabase
    private lateinit var tokenStorage: KeystoreTokenStorage
    private lateinit var cleaner: LocalSessionCleaner

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        database = Room.inMemoryDatabaseBuilder(context, FlashTicketDatabase::class.java)
            .allowMainThreadQueries()
            .build()

        tokenStorage = KeystoreTokenStorage(context)
        tokenStorage.clear()

        cleaner = LocalSessionCleaner(
            tokenStorage = tokenStorage,
            ticketDao = database.ticketDao(),
            categoryDao = database.categoryDao()
        )
    }

    @After
    fun tearDown() {
        database.close()
        tokenStorage.clear()
    }

    @Test
    fun logoutOrTerminalFailure_wipesAllUserScopedDataAndTokenStorage() = runBlocking {
        // Gieo dữ liệu vé và danh mục vào database
        val tickets = listOf(
            TicketEntity(
                id = "t-1",
                ticketCode = "TC-001",
                orderId = "ord-1",
                eventId = "evt-1",
                eventTitle = "Live Show A",
                ticketTypeName = "VIP",
                holderName = "Buyer One",
                status = "ISSUED",
                userId = "user_1"
            )
        )
        val categories = listOf(
            CategoryEntity(id = "cat-1", name = "Music", slug = "music")
        )

        database.ticketDao().insertTickets(tickets)
        database.categoryDao().insertCategories(categories)

        assertEquals(1, database.ticketDao().getTicketCount())
        assertEquals(1, database.categoryDao().getCategoryCount())

        // Kích hoạt dọn dẹp phiên cục bộ (Logout / Terminal Refresh Failure)
        val result = cleaner.clear()

        assertTrue("Logout result must be complete with no failures", result.isComplete)
        assertEquals(0, database.ticketDao().getTicketCount())
        assertEquals(0, database.categoryDao().getCategoryCount())
        assertNull("Token storage must be completely cleared", tokenStorage.readAuthState())
    }

    @Test
    fun accountSwitchViaLogout_wipesPreviousUserRowsBeforeNextSession() = runBlocking {
        database.ticketDao().insertTickets(
            listOf(
                TicketEntity(
                    id = "old-user-ticket",
                    ticketCode = "OLD-001",
                    orderId = "old-order",
                    eventId = "old-event",
                    eventTitle = "Old Session Event",
                    ticketTypeName = "Standard",
                    holderName = "Previous User",
                    status = "ISSUED",
                    userId = "previous-user"
                )
            )
        )

        val result = cleaner.clear()
        assertTrue(result.isComplete)

        database.ticketDao().insertTickets(
            listOf(
                TicketEntity(
                    id = "new-user-ticket",
                    ticketCode = "NEW-001",
                    orderId = "new-order",
                    eventId = "new-event",
                    eventTitle = "New Session Event",
                    ticketTypeName = "Standard",
                    holderName = "Current User",
                    status = "ISSUED",
                    userId = "current-user"
                )
            )
        )

        assertEquals(0, database.ticketDao().getUserTicketCount("previous-user"))
        assertEquals(1, database.ticketDao().getUserTicketCount("current-user"))
    }
}
