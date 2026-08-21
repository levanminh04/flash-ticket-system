package com.flashticket.mobile.app.ui

import android.view.ViewGroup
import androidx.compose.ui.platform.ComposeView
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.flashticket.mobile.MainActivity
import com.flashticket.mobile.R
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class FlashAppShellSmokeTest {

    @Test
    fun mainActivity_launchesSuccessfully_andRendersAppShell() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)

        // Verify Activity reaches RESUMED lifecycle state
        assertEquals(Lifecycle.State.RESUMED, scenario.state)

        scenario.onActivity { activity ->
            assertNotNull("MainActivity instance must not be null", activity)

            val decorView = activity.window.decorView
            assertNotNull("DecorView must be initialized", decorView)
            assertTrue("DecorView must be attached to window", decorView.isAttachedToWindow)

            // Verify ComposeView is present in the view hierarchy
            val rootView = activity.findViewById<ViewGroup>(android.R.id.content)
            assertNotNull("Content view group must exist", rootView)
            assertTrue("Root content group must contain ComposeView", rootView.childCount > 0)
            assertTrue("Root child must be a ComposeView", rootView.getChildAt(0) is ComposeView)

            // Verify localized bottom navigation resources exist
            assertEquals("Khám phá", activity.getString(R.string.tab_discovery))
            assertEquals("Vé của tôi", activity.getString(R.string.tab_tickets))
            assertEquals("Hồ sơ", activity.getString(R.string.tab_profile))
            assertEquals("Khám phá Sự kiện", activity.getString(R.string.title_discovery_card))
            assertEquals("Flash Ticket", activity.getString(R.string.title_app_bar_default))
        }

        scenario.close()
    }
}
