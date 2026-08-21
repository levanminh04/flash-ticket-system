package com.flashticket.mobile.app.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.flashticket.mobile.R
import com.flashticket.mobile.app.navigation.*
import com.flashticket.mobile.core.designsystem.component.FlashErrorView
import com.flashticket.mobile.core.designsystem.component.FlashLoadingView
import com.flashticket.mobile.core.designsystem.component.FlashTopAppBar
import com.flashticket.mobile.core.designsystem.theme.*
import com.flashticket.mobile.core.model.UserRole
import com.flashticket.mobile.feature.poc.G0PocScreen
import com.flashticket.mobile.feature.poc.G0PocViewModel

@Composable
fun FlashAppShell(
    modifier: Modifier = Modifier,
    sessionViewModel: SessionViewModel = hiltViewModel()
) {
    val sessionState by sessionViewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    val loginLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val data = result.data
        if (data != null) {
            sessionViewModel.handleLoginResult(data)
        }
    }

    when (val state = sessionState) {
        is SessionUiState.Loading -> {
            FlashLoadingView(
                message = stringResource(R.string.loading_default),
                modifier = modifier.fillMaxSize()
            )
        }
        is SessionUiState.Unauthenticated -> {
            LoginScreen(
                onLoginClick = {
                    val intent = sessionViewModel.createLoginIntent()
                    loginLauncher.launch(intent)
                },
                modifier = modifier
            )
        }
        is SessionUiState.Error -> {
            FlashErrorView(
                message = state.error.message,
                onRetry = { sessionViewModel.checkSession() },
                modifier = modifier.fillMaxSize()
            )
        }
        is SessionUiState.Authenticated -> {
            AuthenticatedAppShell(
                userProfile = state.userProfile,
                activeRole = state.activeRole,
                onRoleSwitch = { newRole -> sessionViewModel.switchActiveRole(newRole) },
                onLogout = { sessionViewModel.logout() },
                snackbarHostState = snackbarHostState,
                modifier = modifier
            )
        }
    }
}

@Composable
private fun AuthenticatedAppShell(
    userProfile: com.flashticket.mobile.core.model.UserProfile,
    activeRole: UserRole,
    onRoleSwitch: (UserRole) -> Unit,
    onLogout: () -> Unit,
    snackbarHostState: SnackbarHostState,
    modifier: Modifier = Modifier
) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    val (navItems, accentColor, startDestination) = when (activeRole) {
        UserRole.BUYER -> Triple(BuyerBottomNavItems, NeonCyanPrimary, BuyerDiscoveryRoute)
        UserRole.ORGANIZER -> Triple(OrganizerBottomNavItems, NeonVioletSecondary, OrganizerScannerRoute)
        UserRole.ADMIN -> Triple(AdminBottomNavItems, StatusWarning, AdminOrganizersReviewRoute)
    }

    val isG0Poc = currentDestination?.hierarchy?.any { it.hasRoute(G0PocRoute::class) } == true

    val topBarTitle = when {
        currentDestination?.hierarchy?.any { it.hasRoute(BuyerTicketsRoute::class) } == true -> stringResource(R.string.title_app_bar_tickets)
        currentDestination?.hierarchy?.any { it.hasRoute(BuyerProfileRoute::class) || it.hasRoute(OrganizerProfileRoute::class) || it.hasRoute(AdminProfileRoute::class) } == true -> stringResource(R.string.title_app_bar_profile)
        currentDestination?.hierarchy?.any { it.hasRoute(OrganizerScannerRoute::class) } == true -> stringResource(R.string.title_app_bar_scanner)
        currentDestination?.hierarchy?.any { it.hasRoute(OrganizerEventsRoute::class) } == true -> stringResource(R.string.title_app_bar_organizer)
        currentDestination?.hierarchy?.any { it.hasRoute(AdminOrganizersReviewRoute::class) } == true -> stringResource(R.string.title_admin_review_card)
        currentDestination?.hierarchy?.any { it.hasRoute(AdminDashboardRoute::class) } == true -> stringResource(R.string.title_app_bar_admin)
        currentDestination?.hierarchy?.any { it.hasRoute(G0PocRoute::class) } == true -> stringResource(R.string.title_app_bar_poc)
        else -> stringResource(R.string.title_app_bar_default)
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = DarkBackground,
        topBar = {
            if (!isG0Poc) {
                FlashTopAppBar(
                    title = topBarTitle,
                    actions = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RoleBadge(role = activeRole)
                            Spacer(modifier = Modifier.width(16.dp))
                        }
                    }
                )
            }
        },
        bottomBar = {
            if (!isG0Poc) {
                FlashBottomBar(
                    currentDestination = currentDestination,
                    items = navItems,
                    accentColor = accentColor,
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
            startDestination = startDestination,
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Buyer Graph destinations
            composable<BuyerDiscoveryRoute> {
                BuyerDiscoveryScreen(
                    onNavigateToPoc = { navController.navigate(G0PocRoute) }
                )
            }
            composable<BuyerTicketsRoute> {
                BuyerTicketsScreen()
            }
            composable<BuyerProfileRoute> {
                UserProfileScreen(
                    userProfile = userProfile,
                    activeRole = activeRole,
                    onRoleSwitch = onRoleSwitch,
                    onLogoutClick = onLogout
                )
            }

            // Organizer Graph destinations
            composable<OrganizerScannerRoute> {
                OrganizerScannerScreen(
                    onNavigateToPoc = { navController.navigate(G0PocRoute) }
                )
            }
            composable<OrganizerEventsRoute> {
                OrganizerEventsScreen()
            }
            composable<OrganizerProfileRoute> {
                UserProfileScreen(
                    userProfile = userProfile,
                    activeRole = activeRole,
                    onRoleSwitch = onRoleSwitch,
                    onLogoutClick = onLogout
                )
            }

            // Admin Graph destinations
            composable<AdminOrganizersReviewRoute> {
                AdminOrganizersReviewScreen()
            }
            composable<AdminDashboardRoute> {
                AdminDashboardScreen()
            }
            composable<AdminProfileRoute> {
                UserProfileScreen(
                    userProfile = userProfile,
                    activeRole = activeRole,
                    onRoleSwitch = onRoleSwitch,
                    onLogoutClick = onLogout
                )
            }

            // Shared PoC Screen
            composable<G0PocRoute> {
                val pocViewModel: G0PocViewModel = hiltViewModel()
                G0PocScreen(viewModel = pocViewModel)
            }
        }
    }
}
