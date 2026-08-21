package com.flashticket.mobile.core.designsystem

import androidx.compose.ui.unit.dp
import com.flashticket.mobile.core.designsystem.theme.FlashSpacing
import com.flashticket.mobile.core.designsystem.theme.NeonCyanPrimary
import com.flashticket.mobile.core.designsystem.theme.NeonVioletSecondary
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class DesignSystemUnitTest {

    @Test
    fun brandColors_areDefinedCorrectly() {
        assertNotNull(NeonCyanPrimary)
        assertNotNull(NeonVioletSecondary)
    }

    @Test
    fun flashSpacing_defaultValues_matchDesignTokens() {
        val spacing = FlashSpacing()
        assertEquals(4.dp, spacing.extraSmall)
        assertEquals(8.dp, spacing.small)
        assertEquals(12.dp, spacing.medium)
        assertEquals(16.dp, spacing.regular)
        assertEquals(24.dp, spacing.large)
        assertEquals(32.dp, spacing.extraLarge)
        assertEquals(48.dp, spacing.section)
    }
}
