package com.flashticket.mobile.app.navigation

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavDestination
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import com.flashticket.mobile.core.designsystem.theme.*

@Composable
fun FlashBottomBar(
    currentDestination: NavDestination?,
    onNavigateToRoute: (Any) -> Unit,
    modifier: Modifier = Modifier
) {
    NavigationBar(
        modifier = modifier,
        containerColor = DarkSurface,
        contentColor = TextPrimary
    ) {
        BuyerBottomNavItems.forEach { item ->
            val selected = currentDestination?.hierarchy?.any { it.hasRoute(item.route::class) } == true
            val label = stringResource(item.labelResId)

            NavigationBarItem(
                selected = selected,
                onClick = { onNavigateToRoute(item.route) },
                icon = {
                    Icon(
                        imageVector = item.icon,
                        contentDescription = label,
                        tint = if (selected) NeonCyanPrimary else TextMuted
                    )
                },
                label = {
                    Text(
                        text = label,
                        style = MaterialTheme.typography.labelSmall,
                        color = if (selected) NeonCyanPrimary else TextMuted
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    indicatorColor = DarkSurfaceElevated,
                    selectedIconColor = NeonCyanPrimary,
                    unselectedIconColor = TextMuted,
                    selectedTextColor = NeonCyanPrimary,
                    unselectedTextColor = TextMuted
                )
            )
        }
    }
}
