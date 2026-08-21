package com.flashticket.mobile.core.model

/**
 * Mô hình lỗi phân cấp theo ADR-004:
 * - Lưu giữ httpStatus và correlationId để phục vụ chẩn đoán & support.
 * - Tuyệt đối không phát tán raw body, token, PII hoặc exception stack trace lên UI.
 */
sealed class AppError(
    override val message: String,
    open val httpStatus: Int? = null,
    open val correlationId: String? = null
) : Exception(message) {

    data class NetworkUnavailable(
        override val message: String = "Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng.",
        override val correlationId: String? = null
    ) : AppError(message, null, correlationId)

    data class Timeout(
        override val message: String = "Yêu cầu quá thời gian chờ (Timeout). Vui lòng thử lại.",
        override val correlationId: String? = null
    ) : AppError(message, null, correlationId)

    data class SessionExpired(
        override val message: String = "Phiên đăng nhập đã hết hạn.",
        override val httpStatus: Int? = 401,
        override val correlationId: String? = null
    ) : AppError(message, httpStatus, correlationId)

    data class Forbidden(
        override val message: String = "Bạn không có quyền thực hiện thao tác này.",
        override val httpStatus: Int? = 403,
        override val correlationId: String? = null
    ) : AppError(message, httpStatus, correlationId)

    data class NotFound(
        val resource: String = "Resource",
        val identifier: String = "",
        override val message: String = "Không tìm thấy tài nguyên yêu cầu.",
        override val httpStatus: Int? = 404,
        override val correlationId: String? = null
    ) : AppError(message, httpStatus, correlationId)

    data class Validation(
        val fieldErrors: Map<String, String> = emptyMap(),
        override val message: String = "Dữ liệu yêu cầu không hợp lệ.",
        override val httpStatus: Int? = 400,
        override val correlationId: String? = null
    ) : AppError(message, httpStatus, correlationId)

    data class Conflict(
        override val message: String = "Dữ liệu bị xung đột hoặc đã tồn tại.",
        override val httpStatus: Int? = 409,
        override val correlationId: String? = null
    ) : AppError(message, httpStatus, correlationId)

    data class RateLimited(
        val retryAfterSeconds: Long? = null,
        override val message: String = "Quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.",
        override val httpStatus: Int? = 429,
        override val correlationId: String? = null
    ) : AppError(message, httpStatus, correlationId)

    data class Server(
        val code: Int = 500,
        override val message: String = "Lỗi xử lý nội bộ máy chủ ($code).",
        override val correlationId: String? = null
    ) : AppError(message, code, correlationId)

    data class ServerUnavailable(
        val code: Int = 503,
        override val message: String = "Máy chủ đang bảo trì hoặc tạm thời không khả dụng ($code).",
        override val correlationId: String? = null
    ) : AppError(message, code, correlationId)

    data class AuthError(
        override val message: String = "Không thể hoàn tất xác thực. Vui lòng thử lại.",
        override val correlationId: String? = null
    ) : AppError(message, null, correlationId)

    data class Unknown(
        override val httpStatus: Int? = null,
        override val correlationId: String? = null
    ) : AppError("Đã có lỗi không xác định xảy ra.", httpStatus, correlationId)
}
