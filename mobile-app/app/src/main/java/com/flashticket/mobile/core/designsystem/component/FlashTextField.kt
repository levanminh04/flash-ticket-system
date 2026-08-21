package com.flashticket.mobile.core.designsystem.component

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.flashticket.mobile.core.designsystem.theme.*

@Composable
fun FlashTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    errorMessage: String? = null,
    isError: Boolean = !errorMessage.isNullOrBlank(),
    singleLine: Boolean = true,
    leadingIcon: @Composable (() -> Unit)? = null,
    trailingIcon: @Composable (() -> Unit)? = null,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default
) {
    Column(modifier = modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            label = { Text(label) },
            placeholder = placeholder?.let { { Text(it, color = TextMuted) } },
            modifier = Modifier.fillMaxWidth(),
            singleLine = singleLine,
            isError = isError,
            shape = RoundedCornerShape(12.dp),
            leadingIcon = leadingIcon,
            trailingIcon = trailingIcon,
            keyboardOptions = keyboardOptions,
            keyboardActions = keyboardActions,
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = DarkSurface,
                unfocusedContainerColor = DarkSurface,
                disabledContainerColor = DarkSurface,
                errorContainerColor = DarkSurface,
                focusedBorderColor = NeonCyanPrimary,
                unfocusedBorderColor = DarkSurfaceBorder,
                errorBorderColor = NeonCoralError,
                focusedLabelColor = NeonCyanPrimary,
                unfocusedLabelColor = TextSecondary,
                errorLabelColor = NeonCoralError,
                cursorColor = NeonCyanPrimary,
                focusedTextColor = TextPrimary,
                unfocusedTextColor = TextPrimary
            )
        )
        if (isError && !errorMessage.isNullOrBlank()) {
            Text(
                text = errorMessage,
                color = NeonCoralError,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(start = 12.dp, top = 4.dp)
            )
        }
    }
}
