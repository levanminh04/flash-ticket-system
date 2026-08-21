package com.flashticket.mobile.core.model

sealed interface AppError {
    data class Network(val cause: Throwable) : AppError
    data class Unauthenticated(val message: String = "Phiên đăng nhập đã hết hạn") : AppError
    data class Forbidden(val message: String = "Bạn không có quyền truy cập chức năng này") : AppError
    data class NotFound(val resource: String, val identifier: String) : AppError
    data class Validation(val fieldErrors: Map<String, String>, val message: String) : AppError
    data class Conflict(val message: String) : AppError
    data class Server(val code: Int, val message: String) : AppError
    data class Unknown(val rawMessage: String?) : AppError
}

enum class UserRole {
    BUYER,
    ORGANIZER,
    ADMIN;

    companion object {
        fun fromString(value: String): UserRole? = when (value.uppercase()) {
            "BUYER", "ROLE_BUYER" -> BUYER
            "ORGANIZER", "ROLE_ORGANIZER" -> ORGANIZER
            "ADMIN", "ROLE_ADMIN" -> ADMIN
            else -> null
        }
    }
}
