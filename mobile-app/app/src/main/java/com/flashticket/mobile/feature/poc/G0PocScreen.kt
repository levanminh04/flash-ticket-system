package com.flashticket.mobile.feature.poc

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.flashticket.mobile.feature.scanner.CameraQrScannerPreview

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun G0PocScreen(
    viewModel: G0PocViewModel,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()

    val authLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val data = result.data
        if (data != null) {
            viewModel.handleAuthCallback(data)
        }
    }

    val endSessionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { _ ->
        viewModel.onRemoteEndSessionReturned()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Flash Ticket — Gate G0 PoC Screen") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { innerPadding ->
        if (uiState.isScannerActive) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
            ) {
                CameraQrScannerPreview(
                    onQrDetected = { _ -> viewModel.onQrDetected() },
                    onError = { /* Logged internally */ }
                )
                Button(
                    onClick = { viewModel.toggleScanner(false) },
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .padding(24.dp)
                ) {
                    Text("Đóng Camera")
                }
            }
        } else {
            Column(
                modifier = modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(16.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Status Banner
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Text(
                            text = "Trạng thái PoC:",
                            style = MaterialTheme.typography.labelLarge
                        )
                        Text(
                            text = uiState.statusMessage,
                            style = MaterialTheme.typography.bodyMedium
                        )
                    }
                }

                // Section 1: Auth & API-07 Proof
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = "1. Xác thực OIDC & API-07 (Auth PoC)",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text("Trạng thái đăng nhập: ${if (uiState.isAuthenticated) "Đã đăng nhập" else "Chưa đăng nhập"}")
                        Text("Có Access Token: ${if (uiState.hasAccessToken) "Có (Bảo vệ trong Keystore)" else "Chưa có"}")
                        if (uiState.currentUser != null) {
                            Text("Người dùng: ${uiState.currentUser?.displayName}")
                            Text("Vai trò (Roles): ${uiState.currentUser?.roles?.joinToString()}")
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (!uiState.isAuthenticated) {
                                Button(onClick = {
                                    val loginIntent = viewModel.getLoginIntent()
                                    authLauncher.launch(loginIntent)
                                }) {
                                    Text("Đăng nhập Keycloak")
                                }
                            } else {
                                Button(onClick = { viewModel.testCallApi07() }) {
                                    Text("Gọi API-07")
                                }
                                OutlinedButton(onClick = {
                                    viewModel.beginLogout { endSessionIntent ->
                                        if (endSessionIntent != null) {
                                            runCatching { endSessionLauncher.launch(endSessionIntent) }
                                                .onFailure { viewModel.onRemoteEndSessionLaunchFailed() }
                                        }
                                    }
                                }) {
                                    Text("Đăng xuất OIDC & Wipe")
                                }
                            }
                        }
                    }
                }

                // Section 2: Room SQLite Proof
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = "2. Cơ sở dữ liệu Room (Storage PoC)",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text("Database: flash_ticket_android.db")
                        Text("Số bản ghi Categories: ${uiState.dbCategoryCount}")
                        Text("Số bản ghi Tickets: ${uiState.dbTicketCount}")
                        Button(onClick = { viewModel.testWriteSampleDataToRoom() }) {
                            Text("Ghi dữ liệu mẫu vào Room")
                        }
                    }
                }

                // Section 3: CameraX & QR Scanner Proof (Role Boundary Enforced)
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = "3. CameraX & ML Kit (Scanner PoC)",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text("Quyền soát vé (ORGANIZER): ${if (uiState.isOrganizer) "Được phép" else "Không có quyền"}")
                        Text("Trạng thái nhận diện QR: ${if (uiState.hasDetectedQr) "Đã nhận diện mã QR" else "Chưa nhận diện"}")
                        Button(
                            onClick = { viewModel.toggleScanner(true) },
                            enabled = uiState.isOrganizer
                        ) {
                            Text(if (uiState.isOrganizer) "Mở Camera Soát Vé" else "Chỉ dành cho ORGANIZER")
                        }
                    }
                }
            }
        }
    }
}
