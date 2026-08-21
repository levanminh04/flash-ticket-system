package com.flashticket.mobile.core.model

sealed class AppError(
    override val message: String,
    override val cause: Throwable? = null
) : Exception(message, cause) {
    data class Network(override val cause: Throwable, override val message: String = "Lỗi kết nối mạng") : AppError(message, cause)
    data class Unauthenticated(override val message: String = "Phiên đăng nhập đã hết hạn", override val cause: Throwable? = null) : AppError(message, cause)
    data class Forbidden(override val message: String = "Bạn không có quyền truy cập chức năng này", override val cause: Throwable? = null) : AppError(message, cause)
    data class NotFound(val resource: String, val identifier: String, override val message: String = "Không tìm thấy $resource ($identifier)", override val cause: Throwable? = null) : AppError(message, cause)
    data class Validation(val fieldErrors: Map<String, String>, override val message: String = "Dữ liệu không hợp lệ") : AppError(message)
    data class Conflict(override val message: String) : AppError(message)
    data class Server(val code: Int, override val message: String) : AppError(message)
    data class AuthError(override val message: String, override val cause: Throwable? = null) : AppError(message, cause)
    data class SessionExpired(override val message: String = "Phiên đăng nhập đã hết hạn", override val cause: Throwable? = null) : AppError(message, cause)
    data class NetworkUnavailable(override val message: String = "Không có kết nối mạng", override val cause: Throwable? = null) : AppError(message, cause)
    data class ServerUnavailable(override val message: String = "Máy chủ không khả dụng", override val cause: Throwable? = null) : AppError(message, cause)
    data class Unknown(val rawMessage: String?, override val cause: Throwable? = null) : AppError(rawMessage ?: "Đã có lỗi không xác định xảy ra", cause)
}
