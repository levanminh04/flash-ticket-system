package com.flashticket.mobile.app.ui

import android.content.Intent
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.flashticket.mobile.core.auth.AuthCallbackResult
import com.flashticket.mobile.core.auth.AuthSessionController
import com.flashticket.mobile.core.auth.UserRepository
import com.flashticket.mobile.core.model.AppError
import com.flashticket.mobile.core.model.UserProfile
import com.flashticket.mobile.core.model.UserRole
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface SessionUiState {
    data object Loading : SessionUiState
    data object Unauthenticated : SessionUiState
    data class Authenticated(
        val userProfile: UserProfile,
        val activeRole: UserRole = userProfile.primaryRole
    ) : SessionUiState
    data class Error(val error: AppError) : SessionUiState
}

@HiltViewModel
class SessionViewModel @Inject constructor(
    private val authSessionController: AuthSessionController,
    private val userRepository: UserRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<SessionUiState>(SessionUiState.Loading)
    val uiState: StateFlow<SessionUiState> = _uiState.asStateFlow()

    init {
        checkSession()
    }

    fun checkSession() {
        viewModelScope.launch {
            if (authSessionController.isAuthenticated) {
                _uiState.value = SessionUiState.Loading
                fetchProfileAndSetAuthenticated()
            } else {
                _uiState.value = SessionUiState.Unauthenticated
            }
        }
    }

    fun createLoginIntent(): Intent {
        return authSessionController.createAuthorizationIntent()
    }

    fun handleLoginResult(intent: Intent) {
        viewModelScope.launch {
            _uiState.value = SessionUiState.Loading
            when (val result = authSessionController.processAuthorizationResponse(intent)) {
                is AuthCallbackResult.Success -> {
                    fetchProfileAndSetAuthenticated()
                }
                is AuthCallbackResult.Canceled -> {
                    _uiState.value = SessionUiState.Unauthenticated
                }
                is AuthCallbackResult.Error -> {
                    _uiState.value = SessionUiState.Error(result.error)
                }
            }
        }
    }

    private suspend fun fetchProfileAndSetAuthenticated() {
        val result = userRepository.getCurrentUserProfile()
        result.onSuccess { profile ->
            _uiState.value = SessionUiState.Authenticated(
                userProfile = profile,
                activeRole = profile.primaryRole
            )
        }.onFailure { error ->
            if (error is AppError.SessionExpired || error is AppError.AuthError) {
                authSessionController.logout()
                _uiState.value = SessionUiState.Unauthenticated
            } else {
                val appError = (error as? AppError) ?: AppError.Unknown(error.message ?: "Lỗi xác thực", error)
                _uiState.value = SessionUiState.Error(appError)
            }
        }
    }

    fun switchActiveRole(role: UserRole) {
        val current = _uiState.value
        if (current is SessionUiState.Authenticated) {
            // Role Switcher chỉ là UX presentation mode; tuyệt đối không tạo quyền mới vượt quá API-07
            val canSwitch = when (role) {
                UserRole.BUYER -> true
                UserRole.ORGANIZER -> current.userProfile.roles.any { it.contains("ORGANIZER", ignoreCase = true) }
                UserRole.ADMIN -> current.userProfile.roles.any { it.contains("ADMIN", ignoreCase = true) }
            }
            if (canSwitch) {
                _uiState.value = current.copy(activeRole = role)
            }
        }
    }

    fun logout() {
        viewModelScope.launch {
            _uiState.value = SessionUiState.Loading
            authSessionController.logout()
            _uiState.value = SessionUiState.Unauthenticated
        }
    }
}
