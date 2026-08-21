package com.flashticket.mobile.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.flashticket.mobile.R
import com.flashticket.mobile.core.designsystem.component.FlashCard
import com.flashticket.mobile.core.designsystem.component.FlashPrimaryButton
import com.flashticket.mobile.core.designsystem.component.FlashSecondaryButton
import com.flashticket.mobile.core.designsystem.theme.*
import com.flashticket.mobile.core.model.UserProfile
import com.flashticket.mobile.core.model.UserRole

@Composable
fun LoginScreen(
    onLoginClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(
                imageVector = Icons.Default.ConfirmationNumber,
                contentDescription = null,
                tint = NeonCyanPrimary,
                modifier = Modifier.size(64.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = stringResource(R.string.title_welcome),
                style = MaterialTheme.typography.headlineMedium,
                color = TextPrimary
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = stringResource(R.string.desc_welcome),
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary,
                modifier = Modifier.padding(horizontal = 16.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
            Spacer(modifier = Modifier.height(32.dp))
            FlashPrimaryButton(
                text = stringResource(R.string.btn_login_oidc),
                onClick = onLoginClick,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

@Composable
fun UserProfileScreen(
    userProfile: UserProfile,
    activeRole: UserRole,
    onRoleSwitch: (UserRole) -> Unit,
    onLogoutClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        FlashCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column {
                        Text(
                            text = userProfile.displayName,
                            style = MaterialTheme.typography.titleLarge,
                            color = TextPrimary
                        )
                        Text(
                            text = userProfile.email,
                            style = MaterialTheme.typography.bodyMedium,
                            color = TextSecondary
                        )
                    }
                    RoleBadge(role = activeRole)
                }

                Spacer(modifier = Modifier.height(16.dp))
                HorizontalDivider(color = BorderSubtle)
                Spacer(modifier = Modifier.height(16.dp))

                // Role Switching options if user possesses organizer or admin capabilities
                val isOrganizer = userProfile.roles.any { it.contains("ORGANIZER", ignoreCase = true) } || userProfile.primaryRole == UserRole.ADMIN
                val isAdmin = userProfile.roles.any { it.contains("ADMIN", ignoreCase = true) }

                if (isOrganizer || isAdmin) {
                    Text(
                        text = stringResource(R.string.label_current_role),
                        style = MaterialTheme.typography.labelMedium,
                        color = TextMuted
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        FilterChip(
                            selected = activeRole == UserRole.BUYER,
                            onClick = { onRoleSwitch(UserRole.BUYER) },
                            label = { Text("Buyer") }
                        )
                        if (isOrganizer) {
                            FilterChip(
                                selected = activeRole == UserRole.ORGANIZER,
                                onClick = { onRoleSwitch(UserRole.ORGANIZER) },
                                label = { Text("Organizer") }
                            )
                        }
                        if (isAdmin) {
                            FilterChip(
                                selected = activeRole == UserRole.ADMIN,
                                onClick = { onRoleSwitch(UserRole.ADMIN) },
                                label = { Text("Admin") }
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                }

                FlashSecondaryButton(
                    text = stringResource(R.string.btn_logout),
                    onClick = onLogoutClick,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
fun RoleBadge(
    role: UserRole,
    modifier: Modifier = Modifier
) {
    val pair: Pair<androidx.compose.ui.graphics.Color, androidx.compose.ui.graphics.Color> = when (role) {
        UserRole.BUYER -> Pair(NeonCyanPrimary.copy(alpha = 0.2f), NeonCyanPrimary)
        UserRole.ORGANIZER -> Pair(NeonVioletSecondary.copy(alpha = 0.2f), NeonVioletSecondary)
        UserRole.ADMIN -> Pair(StatusWarning.copy(alpha = 0.2f), StatusWarning)
    }
    val badgeColor = pair.first
    val textColor = pair.second

    Box(
        modifier = modifier
            .background(color = badgeColor, shape = RoundedCornerShape(4.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = role.name,
            style = MaterialTheme.typography.labelSmall,
            color = textColor
        )
    }
}

@Composable
fun BuyerDiscoveryScreen(
    onNavigateToPoc: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        FlashCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = stringResource(R.string.title_discovery_card),
                    style = MaterialTheme.typography.titleLarge,
                    color = TextPrimary
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = stringResource(R.string.desc_discovery_card),
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary
                )
                Spacer(modifier = Modifier.height(16.dp))
                FlashPrimaryButton(
                    text = stringResource(R.string.btn_open_poc),
                    onClick = onNavigateToPoc
                )
            }
        }
    }
}

@Composable
fun BuyerTicketsScreen(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = null,
                tint = NeonCyanPrimary,
                modifier = Modifier.size(48.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = stringResource(R.string.title_tickets_placeholder),
                style = MaterialTheme.typography.titleMedium,
                color = TextPrimary
            )
            Text(
                text = stringResource(R.string.desc_tickets_placeholder),
                style = MaterialTheme.typography.bodyMedium,
                color = TextMuted
            )
        }
    }
}

@Composable
fun OrganizerScannerScreen(
    onNavigateToPoc: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        FlashCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = stringResource(R.string.title_organizer_scanner_card),
                    style = MaterialTheme.typography.titleLarge,
                    color = TextPrimary
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = stringResource(R.string.desc_organizer_scanner_card),
                    style = MaterialTheme.typography.bodyMedium,
                    color = TextSecondary
                )
                Spacer(modifier = Modifier.height(16.dp))
                FlashPrimaryButton(
                    text = stringResource(R.string.tab_scanner),
                    onClick = onNavigateToPoc
                )
            }
        }
    }
}

@Composable
fun OrganizerEventsScreen(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                imageVector = Icons.Default.Event,
                contentDescription = null,
                tint = NeonVioletSecondary,
                modifier = Modifier.size(48.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = stringResource(R.string.title_organizer_events_card),
                style = MaterialTheme.typography.titleMedium,
                color = TextPrimary
            )
            Text(
                text = stringResource(R.string.desc_organizer_events_card),
                style = MaterialTheme.typography.bodyMedium,
                color = TextMuted
            )
        }
    }
}

@Composable
fun AdminOrganizersReviewScreen(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                imageVector = Icons.Default.VerifiedUser,
                contentDescription = null,
                tint = StatusWarning,
                modifier = Modifier.size(48.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = stringResource(R.string.title_admin_review_card),
                style = MaterialTheme.typography.titleMedium,
                color = TextPrimary
            )
            Text(
                text = stringResource(R.string.desc_admin_review_card),
                style = MaterialTheme.typography.bodyMedium,
                color = TextMuted
            )
        }
    }
}

@Composable
fun AdminDashboardScreen(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                imageVector = Icons.Default.Settings,
                contentDescription = null,
                tint = NeonCyanPrimary,
                modifier = Modifier.size(48.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = stringResource(R.string.title_admin_dashboard_card),
                style = MaterialTheme.typography.titleMedium,
                color = TextPrimary
            )
            Text(
                text = stringResource(R.string.desc_admin_dashboard_card),
                style = MaterialTheme.typography.bodyMedium,
                color = TextMuted
            )
        }
    }
}
