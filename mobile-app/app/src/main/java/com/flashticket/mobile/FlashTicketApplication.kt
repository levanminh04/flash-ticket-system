package com.flashticket.mobile

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class FlashTicketApplication : Application() {
    override fun onCreate() {
        super.onCreate()
    }
}
