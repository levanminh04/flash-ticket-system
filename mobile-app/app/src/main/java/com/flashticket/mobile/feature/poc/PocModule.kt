package com.flashticket.mobile.feature.poc

import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class PocModule {
    @Binds
    @Singleton
    abstract fun bindPocDataSource(impl: PocRepository): PocDataSource
}
