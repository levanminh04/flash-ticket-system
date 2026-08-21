package com.flashticket.mobile.core.designsystem.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

data class FlashSpacing(
    val extraSmall: Dp = 4.dp,
    val small: Dp = 8.dp,
    val medium: Dp = 12.dp,
    val regular: Dp = 16.dp,
    val large: Dp = 24.dp,
    val extraLarge: Dp = 32.dp,
    val section: Dp = 48.dp
)

val LocalFlashSpacing = staticCompositionLocalOf { FlashSpacing() }

object FlashTheme {
    val spacing: FlashSpacing
        @Composable
        @ReadOnlyComposable
        get() = LocalFlashSpacing.current
}
