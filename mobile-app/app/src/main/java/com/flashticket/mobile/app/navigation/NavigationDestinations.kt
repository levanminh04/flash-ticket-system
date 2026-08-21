package com.flashticket.mobile.app.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.ui.graphics.vector.ImageVector
import com.flashticket.mobile.R
import kotlinx.serialization.Serializable

// Top-Level Graphs according to ADR-003
@Serializable
object AuthGraph

@Serializable
object GuestGraph

@Serializable
object BuyerGraph

@Serializable
object OrganizerGraph

@Serializable
object AdminGraph

// Type-Safe Routes
@Serializable
object LoginRoute

@Serializable
object G0PocRoute

@Serializable
object BuyerDiscoveryRoute

@Serializable
object BuyerTicketsRoute

@Serializable
object BuyerProfileRoute

@Serializable
object OrganizerDashboardRoute

@Serializable
object AdminDashboardRoute

data class BottomNavItem(
    val route: Any,
    val labelResId: Int,
    val icon: ImageVector
)

val BuyerBottomNavItems = listOf(
    BottomNavItem(
        route = BuyerDiscoveryRoute,
        labelResId = R.string.tab_discovery,
        icon = Icons.Default.Home
    ),
    BottomNavItem(
        route = BuyerTicketsRoute,
        labelResId = R.string.tab_tickets,
        icon = Icons.Default.Search
    ),
    BottomNavItem(
        route = BuyerProfileRoute,
        labelResId = R.string.tab_profile,
        icon = Icons.Default.Person
    )
)
