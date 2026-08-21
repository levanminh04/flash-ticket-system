package com.flashticket.mobile.core.database

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class FlashTicketDatabaseInstrumentedTest {

    private lateinit var database: FlashTicketDatabase
    private lateinit var categoryDao: CategoryDao
    private lateinit var ticketDao: TicketDao

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        database = Room.inMemoryDatabaseBuilder(context, FlashTicketDatabase::class.java)
            .allowMainThreadQueries()
            .build()

        categoryDao = database.categoryDao()
        ticketDao = database.ticketDao()
    }

    @After
    fun tearDown() {
        database.close()
    }

    @Test
    fun database_hasExactDatabaseName() {
        assertEquals("flash_ticket_android.db", FlashTicketDatabase.DATABASE_NAME)
    }

    @Test
    fun database_namedFile_canBeCreatedAndOpenedWithVersionOneSchema() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.deleteDatabase(FlashTicketDatabase.DATABASE_NAME)
        val namedDatabase = Room.databaseBuilder(
            context,
            FlashTicketDatabase::class.java,
            FlashTicketDatabase.DATABASE_NAME
        ).allowMainThreadQueries().build()

        try {
            namedDatabase.openHelper.writableDatabase
            assertTrue(context.getDatabasePath(FlashTicketDatabase.DATABASE_NAME).exists())
            assertEquals(1, namedDatabase.openHelper.readableDatabase.version)
        } finally {
            namedDatabase.close()
            context.deleteDatabase(FlashTicketDatabase.DATABASE_NAME)
        }
    }

    @Test
    fun categoryDao_insertAndRetrieveOrderedByDisplayOrder() = runBlocking {
        val categories = listOf(
            CategoryEntity(id = "cat-2", name = "Âm nhạc", slug = "am-nhac", displayOrder = 2),
            CategoryEntity(id = "cat-1", name = "Sân khấu", slug = "san-khau", displayOrder = 1)
        )

        categoryDao.insertCategories(categories)

        val retrieved = categoryDao.getAllCategories().first()
        assertEquals(2, retrieved.size)
        assertEquals("cat-1", retrieved[0].id)
        assertEquals("cat-2", retrieved[1].id)
    }

    @Test
    fun ticketDao_userScopedPartition_strictlyIsolatesByUser() = runBlocking {
        val userATickets = listOf(
            TicketEntity(
                id = "t-1",
                ticketCode = "TC-111",
                orderId = "ord-1",
                eventId = "evt-1",
                eventTitle = "Concert A",
                ticketTypeName = "VIP",
                holderName = "User A",
                status = "ISSUED",
                userId = "user_A"
            )
        )
        val userBTickets = listOf(
            TicketEntity(
                id = "t-2",
                ticketCode = "TC-222",
                orderId = "ord-2",
                eventId = "evt-2",
                eventTitle = "Concert B",
                ticketTypeName = "Standard",
                holderName = "User B",
                status = "ISSUED",
                userId = "user_B"
            )
        )

        ticketDao.insertTickets(userATickets)
        ticketDao.insertTickets(userBTickets)

        // Query cho User A
        val ticketsForA = ticketDao.getTicketsByUserId("user_A").first()
        assertEquals(1, ticketsForA.size)
        assertEquals("TC-111", ticketsForA[0].ticketCode)

        // Query cho User B
        val ticketsForB = ticketDao.getTicketsByUserId("user_B").first()
        assertEquals(1, ticketsForB.size)
        assertEquals("TC-222", ticketsForB[0].ticketCode)

        // User A không thể đọc ticket của User B
        val crossQueryResult = ticketDao.getTicketById("t-2", "user_A")
        assertNull(crossQueryResult)
    }

    @Test
    fun ticketDao_clearUserTickets_removesOnlyTargetUserTickets() = runBlocking {
        val tickets = listOf(
            TicketEntity(
                id = "t-1",
                ticketCode = "TC-111",
                orderId = "ord-1",
                eventId = "evt-1",
                eventTitle = "Concert A",
                ticketTypeName = "VIP",
                holderName = "User A",
                status = "ISSUED",
                userId = "user_A"
            ),
            TicketEntity(
                id = "t-2",
                ticketCode = "TC-222",
                orderId = "ord-2",
                eventId = "evt-2",
                eventTitle = "Concert B",
                ticketTypeName = "Standard",
                holderName = "User B",
                status = "ISSUED",
                userId = "user_B"
            )
        )
        ticketDao.insertTickets(tickets)

        // Xóa vé của User A
        ticketDao.clearUserTickets("user_A")

        assertEquals(0, ticketDao.getUserTicketCount("user_A"))
        assertEquals(1, ticketDao.getUserTicketCount("user_B"))
    }
}
