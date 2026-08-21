package com.flashticket.mobile.core.designsystem.component

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.flashticket.mobile.core.designsystem.theme.DarkCardBackground
import com.flashticket.mobile.core.designsystem.theme.DarkSurfaceBorder

@Composable
fun FlashCard(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 16.dp,
    borderStroke: BorderStroke? = BorderStroke(1.dp, DarkSurfaceBorder),
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(cornerRadius),
        colors = CardDefaults.cardColors(
            containerColor = DarkCardBackground
        ),
        border = borderStroke,
        content = content
    )
}
