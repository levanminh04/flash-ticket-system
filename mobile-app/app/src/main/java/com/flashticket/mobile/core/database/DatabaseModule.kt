package com.flashticket.mobile.core.database

import android.content.Context
import androidx.room.Room
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideFlashTicketDatabase(
        @ApplicationContext context: Context
    ): FlashTicketDatabase {
        return Room.databaseBuilder(
            context,
            FlashTicketDatabase::class.java,
            FlashTicketDatabase.DATABASE_NAME
        ).build()
    }

    @Provides
    fun provideCategoryDao(database: FlashTicketDatabase): CategoryDao {
        return database.categoryDao()
    }

    @Provides
    fun provideTicketDao(database: FlashTicketDatabase): TicketDao {
        return database.ticketDao()
    }
}
