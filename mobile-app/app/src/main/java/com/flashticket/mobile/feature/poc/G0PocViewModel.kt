package com.flashticket.mobile.feature.poc

import android.content.Intent
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.flashticket.mobile.core.auth.AuthSessionController
import com.flashticket.mobile.core.auth.LocalSessionData
import com.flashticket.mobile.core.model.UserProfile
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class G0PocUiState(
    val isAuthenticated: Boolean = false,
    val hasAccessToken: Boolean = false,
    val currentUser: UserProfile? = null,
    val isOrganizer: Boolean = false,
    val dbCategoryCount: Int = 0,
    val dbTicketCount: Int = 0,
    val hasDetectedQr: Boolean = false,
    val isScannerActive: Boolean = false,
    val hasLocalWipeFailure: Boolean = false,
    val statusMessage: String = "Sẵn sàng kiểm thử PoC G0"
)

@HiltViewModel
class G0PocViewModel @Inject constructor(
    private val authSessionController: AuthSessionController,
    private val pocDataSource: PocDataSource
) : ViewModel() {

    private val _uiState = MutableStateFlow(G0PocUiState())
    val uiState: StateFlow<G0PocUiState> = _uiState.asStateFlow()

    init {
        refreshState()
    }

    fun refreshState() {
        viewModelScope.launch {
            val isAuth = authSessionController.isAuthenticated
            val token = authSessionController.getValidAccessToken()
            val catCount = pocDataSource.getCategoryCount()
            val tktCount = pocDataSource.getTicketCount()

            _uiState.update {
                it.copy(
                    isAuthenticated = isAuth,
                    hasAccessToken = !token.isNullOrBlank(),
                    dbCategoryCount = catCount,
                    dbTicketCount = tktCount
                )
            }
        }
    }

    fun getLoginIntent(): Intent {
        return authSessionController.createAuthorizationIntent()
    }

    fun handleAuthCallback(intent: Intent) {
        viewModelScope.launch {
            _uiState.update { it.copy(statusMessage = "Đang xử lý kết quả đăng nhập OIDC...") }
            val success = authSessionController.handleAuthorizationResponse(intent)
            if (success) {
                refreshState()
                _uiState.update { it.copy(statusMessage = "Đăng nhập thành công qua AppAuth PKCE S256") }
                testCallApi07()
            } else {
                _uiState.update { it.copy(statusMessage = "Đăng nhập thất bại hoặc bị hủy") }
            }
        }
    }

    fun testCallApi07() {
        viewModelScope.launch {
            _uiState.update { it.copy(statusMessage = "Đang gọi API-07 /api/users/me...") }
            pocDataSource.getCurrentUser()
                .onSuccess { user ->
                    val isOrg = user.roles.any { it.equals("ORGANIZER", ignoreCase = true) || it.equals("ROLE_ORGANIZER", ignoreCase = true) }
                    _uiState.update {
                        it.copy(
                            currentUser = user,
                            isOrganizer = isOrg,
                            statusMessage = "Gọi API-07 thành công: Xác thực người dùng ${user.displayName}"
                        )
                    }
                }
                .onFailure { e ->
                    _uiState.update {
                        it.copy(statusMessage = "Lỗi gọi API-07: ${e.message ?: "Không thể kết nối Gateway"}")
                    }
                }
        }
    }

    fun testWriteSampleDataToRoom() {
        viewModelScope.launch {
            pocDataSource.insertSampleData()
            refreshState()
            _uiState.update { it.copy(statusMessage = "Đã ghi 1 Category và 1 Ticket mẫu vào Room DB") }
        }
    }

    fun beginLogout(onLocalWipeFinished: (Intent?) -> Unit) {
        val endSessionIntent = authSessionController.createEndSessionIntent()
        viewModelScope.launch {
            _uiState.update { it.copy(statusMessage = "Đang xóa session và dữ liệu cục bộ...") }
            val logoutResult = authSessionController.logout()
            _uiState.update {
                it.copy(
                    isAuthenticated = false,
                    hasAccessToken = false,
                    currentUser = null,
                    isOrganizer = false,
                    hasDetectedQr = false,
                    isScannerActive = false,
                    hasLocalWipeFailure = !logoutResult.isComplete,
                    dbCategoryCount = if (LocalSessionData.CATEGORIES !in logoutResult.failedData) 0 else it.dbCategoryCount,
                    dbTicketCount = if (LocalSessionData.TICKETS !in logoutResult.failedData) 0 else it.dbTicketCount,
                    statusMessage = if (logoutResult.isComplete) {
                        "Đã xóa session và dữ liệu cục bộ"
                    } else {
                        "Đăng xuất chưa xóa hết dữ liệu cục bộ; vui lòng thử lại"
                    }
                )
            }
            onLocalWipeFinished(endSessionIntent)
        }
    }

    fun onRemoteEndSessionReturned() {
        _uiState.update {
            it.copy(
                statusMessage = if (it.hasLocalWipeFailure) {
                    "Đã đóng luồng OIDC nhưng chưa xóa hết dữ liệu cục bộ; vui lòng thử lại"
                } else {
                    "Đã đóng luồng đăng xuất OIDC; dữ liệu cục bộ đã được xóa"
                }
            )
        }
    }

    fun onRemoteEndSessionLaunchFailed() {
        _uiState.update {
            it.copy(
                statusMessage = if (it.hasLocalWipeFailure) {
                    "Không mở được logout OIDC và chưa xóa hết dữ liệu cục bộ; vui lòng thử lại"
                } else {
                    "Không mở được logout OIDC; dữ liệu cục bộ vẫn đã được xóa"
                }
            )
        }
    }

    fun toggleScanner(active: Boolean) {
        if (active && !_uiState.value.isOrganizer) {
            _uiState.update { it.copy(statusMessage = "Chỉ tài khoản Ban tổ chức (ORGANIZER) mới có quyền soát vé") }
            return
        }
        _uiState.update { it.copy(isScannerActive = active) }
    }

    fun onQrDetected() {
        _uiState.update {
            it.copy(
                hasDetectedQr = true,
                isScannerActive = false,
                statusMessage = "Đã nhận diện mã QR thành công (Sẵn sàng gửi check-in)"
            )
        }
    }
}
