package com.flashticket.mobile.core.designsystem.component

import androidx.compose.foundation.layout.RowScope
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.flashticket.mobile.core.designsystem.theme.DarkBackground
import com.flashticket.mobile.core.designsystem.theme.DarkSurfaceBorder
import com.flashticket.mobile.core.designsystem.theme.TextPrimary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FlashTopAppBar(
    title: String,
    modifier: Modifier = Modifier,
    navigationIcon: @Composable (() -> Unit) = {},
    actions: @Composable RowScope.() -> Unit = {}
) {
    TopAppBar(
        title = {
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                color = TextPrimary
            )
        },
        modifier = modifier,
        navigationIcon = navigationIcon,
        actions = actions,
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = DarkBackground,
            titleContentColor = TextPrimary,
            actionIconContentColor = TextPrimary,
            navigationIconContentColor = TextPrimary
        )
    )
}
