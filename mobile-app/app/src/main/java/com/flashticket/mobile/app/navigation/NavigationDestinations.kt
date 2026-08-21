package com.flashticket.mobile.app.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.VerifiedUser
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

// Buyer Routes
@Serializable
object BuyerDiscoveryRoute

@Serializable
object BuyerTicketsRoute

@Serializable
object BuyerProfileRoute

// Organizer Routes
@Serializable
object OrganizerScannerRoute

@Serializable
object OrganizerEventsRoute

@Serializable
object OrganizerProfileRoute

// Admin Routes
@Serializable
object AdminOrganizersReviewRoute

@Serializable
object AdminDashboardRoute

@Serializable
object AdminProfileRoute

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

val OrganizerBottomNavItems = listOf(
    BottomNavItem(
        route = OrganizerScannerRoute,
        labelResId = R.string.tab_scanner,
        icon = Icons.Default.QrCodeScanner
    ),
    BottomNavItem(
        route = OrganizerEventsRoute,
        labelResId = R.string.tab_organizer_events,
        icon = Icons.Default.Event
    ),
    BottomNavItem(
        route = OrganizerProfileRoute,
        labelResId = R.string.tab_profile,
        icon = Icons.Default.Person
    )
)

val AdminBottomNavItems = listOf(
    BottomNavItem(
        route = AdminOrganizersReviewRoute,
        labelResId = R.string.tab_organizer_review,
        icon = Icons.Default.VerifiedUser
    ),
    BottomNavItem(
        route = AdminDashboardRoute,
        labelResId = R.string.tab_system_dashboard,
        icon = Icons.Default.Settings
    ),
    BottomNavItem(
        route = AdminProfileRoute,
        labelResId = R.string.tab_profile,
        icon = Icons.Default.Person
    )
)
