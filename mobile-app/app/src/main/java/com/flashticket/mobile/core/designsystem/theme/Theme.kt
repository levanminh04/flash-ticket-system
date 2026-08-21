package com.flashticket.mobile.core.designsystem.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val DarkColorScheme = darkColorScheme(
    primary = NeonCyanPrimary,
    onPrimary = Color(0xFF003642),
    primaryContainer = NeonCyanDark,
    onPrimaryContainer = NeonCyanLight,
    secondary = NeonVioletSecondary,
    onSecondary = Color(0xFF38006B),
    secondaryContainer = NeonVioletDark,
    onSecondaryContainer = NeonVioletLight,
    tertiary = NeonMagentaAccent,
    background = DarkBackground,
    onBackground = TextPrimary,
    surface = DarkSurface,
    onSurface = TextPrimary,
    surfaceVariant = DarkSurfaceElevated,
    onSurfaceVariant = TextSecondary,
    outline = DarkSurfaceBorder,
    error = NeonCoralError,
    onError = Color.White
)

@Composable
fun FlashTicketTheme(
    darkTheme: Boolean = true, // Neon Dark Theme là chủ đạo theo Brand Identity
    content: @Composable () -> Unit
) {
    val colorScheme = DarkColorScheme
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = DarkBackground.toArgb()
            window.navigationBarColor = DarkBackground.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = false
            WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = false
        }
    }

    CompositionLocalProvider(
        LocalFlashSpacing provides FlashSpacing()
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = FlashTypography,
            shapes = FlashShapes,
            content = content
        )
    }
}
