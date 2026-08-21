package com.flashticket.mobile.core.network

import com.flashticket.mobile.core.model.AppError
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import retrofit2.HttpException
import java.io.IOException
import java.net.SocketTimeoutException
import javax.inject.Inject
import javax.inject.Singleton

@Serializable
data class FieldErrorDto(
    val field: String? = null,
    val defaultMessage: String? = null,
    val rejectedValue: String? = null
)

@Serializable
data class ErrorResponseDto(
    val timestamp: String? = null,
    val status: Int? = null,
    val error: String? = null,
    val message: String? = null,
    val path: String? = null,
    val errors: List<FieldErrorDto> = emptyList(),
    val code: String? = null
)

@Singleton
class ErrorParser @Inject constructor(
    private val json: Json
) {
    fun parse(throwable: Throwable): AppError {
        return when (throwable) {
            is AppError -> throwable
            is SocketTimeoutException -> AppError.Timeout(
                message = "Yêu cầu quá thời gian chờ (Timeout). Vui lòng thử lại."
            )
            is IOException -> AppError.NetworkUnavailable(
                message = "Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng."
            )
            is HttpException -> parseHttpException(throwable)
            else -> AppError.Unknown()
        }
    }

    fun parseHttpException(exception: HttpException): AppError {
        val response = exception.response()
        val code = exception.code()
        val headers = response?.headers()
        val correlationId = headers?.get("X-Correlation-ID")

        val errorBody = try {
            response?.errorBody()?.string()
        } catch (e: Exception) {
            null
        }

        val parsedDto = if (!errorBody.isNullOrBlank()) {
            try {
                json.decodeFromString<ErrorResponseDto>(errorBody)
            } catch (e: Exception) {
                null
            }
        } else null

        return when (code) {
            400, 422 -> {
                val fieldErrors = parsedDto?.errors
                    ?.filter { !it.field.isNullOrBlank() }
                    ?.filter { it.field.orEmpty().matches(SAFE_FIELD_NAME) }
                    ?.associate { requireNotNull(it.field) to "Giá trị không hợp lệ." }
                    ?: emptyMap()
                AppError.Validation(
                    fieldErrors = fieldErrors,
                    message = "Dữ liệu yêu cầu không hợp lệ.",
                    httpStatus = code,
                    correlationId = correlationId
                )
            }
            401 -> AppError.SessionExpired(
                message = "Phiên đăng nhập đã hết hạn.",
                correlationId = correlationId
            )
            403 -> AppError.Forbidden(
                message = "Bạn không có quyền thực hiện thao tác này.",
                correlationId = correlationId
            )
            404 -> AppError.NotFound(
                resource = "Resource",
                identifier = "",
                message = "Không tìm thấy tài nguyên yêu cầu.",
                correlationId = correlationId
            )
            409 -> AppError.Conflict(
                message = "Dữ liệu bị xung đột hoặc đã tồn tại.",
                correlationId = correlationId
            )
            429 -> {
                val retryAfterHeader = headers?.get("Retry-After")
                val retryAfterSeconds = retryAfterHeader?.toLongOrNull()
                    ?.takeIf { it in 0..MAX_RETRY_AFTER_SECONDS }
                AppError.RateLimited(
                    retryAfterSeconds = retryAfterSeconds,
                    message = "Quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.",
                    correlationId = correlationId
                )
            }
            500 -> AppError.Server(
                code = 500,
                message = "Lỗi xử lý nội bộ máy chủ (500). Vui lòng thử lại sau.",
                correlationId = correlationId
            )
            502, 503, 504 -> AppError.ServerUnavailable(
                code = code,
                message = "Máy chủ tạm thời không khả dụng ($code). Vui lòng thử lại sau.",
                correlationId = correlationId
            )
            else -> AppError.Server(
                code = code,
                message = "Lỗi phản hồi từ máy chủ ($code).",
                correlationId = correlationId
            )
        }
    }

    private companion object {
        val SAFE_FIELD_NAME = Regex("[A-Za-z0-9_.-]{1,64}")
        const val MAX_RETRY_AFTER_SECONDS = 86_400L
    }
}
