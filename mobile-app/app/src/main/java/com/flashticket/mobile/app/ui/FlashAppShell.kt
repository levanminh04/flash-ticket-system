package com.flashticket.mobile.app.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.flashticket.mobile.R
import com.flashticket.mobile.app.navigation.*
import com.flashticket.mobile.core.designsystem.component.FlashTopAppBar
import com.flashticket.mobile.core.designsystem.theme.DarkBackground
import com.flashticket.mobile.feature.poc.G0PocScreen
import com.flashticket.mobile.feature.poc.G0PocViewModel

@Composable
fun FlashAppShell(
    modifier: Modifier = Modifier
) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination
    val snackbarHostState = remember { SnackbarHostState() }

    val isBuyerDiscovery = currentDestination?.hierarchy?.any { it.hasRoute(BuyerDiscoveryRoute::class) } == true
    val isBuyerTickets = currentDestination?.hierarchy?.any { it.hasRoute(BuyerTicketsRoute::class) } == true
    val isBuyerProfile = currentDestination?.hierarchy?.any { it.hasRoute(BuyerProfileRoute::class) } == true
    val isG0Poc = currentDestination?.hierarchy?.any { it.hasRoute(G0PocRoute::class) } == true

    val showBottomBar = isBuyerDiscovery || isBuyerTickets || isBuyerProfile

    val topBarTitle = when {
        isBuyerTickets -> stringResource(R.string.title_app_bar_tickets)
        isBuyerProfile -> stringResource(R.string.title_app_bar_profile)
        isG0Poc -> stringResource(R.string.title_app_bar_poc)
        else -> stringResource(R.string.title_app_bar_default)
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = DarkBackground,
        topBar = {
            if (!isG0Poc) {
                FlashTopAppBar(title = topBarTitle)
            }
        },
        bottomBar = {
            if (showBottomBar) {
                FlashBottomBar(
                    currentDestination = currentDestination,
                    onNavigateToRoute = { route ->
                        navController.navigate(route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                )
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = BuyerDiscoveryRoute,
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            composable<BuyerDiscoveryRoute> {
                BuyerDiscoveryScreen(
                    onNavigateToPoc = {
                        navController.navigate(G0PocRoute)
                    }
                )
            }
            composable<BuyerTicketsRoute> {
                BuyerTicketsScreen()
            }
            composable<BuyerProfileRoute> {
                BuyerProfileScreen()
            }
            composable<G0PocRoute> {
                val pocViewModel: G0PocViewModel = hiltViewModel()
                G0PocScreen(viewModel = pocViewModel)
            }
        }
    }
}
