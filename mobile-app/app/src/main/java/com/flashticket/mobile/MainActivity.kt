package com.flashticket.mobile

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import com.flashticket.mobile.app.ui.FlashAppShell
import com.flashticket.mobile.app.ui.SessionViewModel
import com.flashticket.mobile.core.designsystem.theme.FlashTicketTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    private val sessionViewModel: SessionViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        if (intent?.data != null) {
            sessionViewModel.handleLoginResult(intent)
        }

        setContent {
            FlashTicketTheme {
                FlashAppShell(sessionViewModel = sessionViewModel)
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (intent.data != null) {
            sessionViewModel.handleLoginResult(intent)
        }
    }
}
