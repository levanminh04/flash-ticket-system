package com.flashticket.mobile.core.network

import com.flashticket.mobile.core.model.AppError
import kotlinx.serialization.json.Json
import okhttp3.Headers
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response
import java.io.IOException
import java.net.SocketTimeoutException

class ErrorParserUnitTest {

    private lateinit var json: Json
    private lateinit var errorParser: ErrorParser

    @Before
    fun setUp() {
        json = Json {
            ignoreUnknownKeys = true
            coerceInputValues = true
            isLenient = false
            encodeDefaults = false
        }
        errorParser = ErrorParser(json)
    }

    @Test
    fun parse_socketTimeoutException_returnsTimeoutError() {
        val exception = SocketTimeoutException("Read timed out")
        val error = errorParser.parse(exception)

        assertTrue(error is AppError.Timeout)
        assertTrue(error.message.contains("Timeout"))
    }

    @Test
    fun parse_ioException_returnsNetworkUnavailableError() {
        val exception = IOException("Failed to connect to /15.134.248.39:80")
        val error = errorParser.parse(exception)

        assertTrue(error is AppError.NetworkUnavailable)
    }

    @Test
    fun parse_http400_withValidationErrors_andCorrelationId_mapsCorrectly() {
        val errorJson = """
            {
                "timestamp": "2026-08-22T02:00:00.000+00:00",
                "status": 400,
                "error": "Bad Request",
                "message": "Dữ liệu không hợp lệ",
                "path": "/api/users/me/profile",
                "errors": [
                    {
                        "field": "phone",
                        "defaultMessage": "Số điện thoại không hợp lệ"
                    },
                    {
                        "field": "fullName",
                        "defaultMessage": "Họ và tên không được để trống"
                    }
                ]
            }
        """.trimIndent()

        val headers = Headers.Builder()
            .add("X-Correlation-ID", "corr-abc-123")
            .build()

        val response = Response.error<Any>(
            400,
            errorJson.toResponseBody("application/json".toMediaType())
        ).let { Response.error<Any>(errorJson.toResponseBody("application/json".toMediaType()), okhttp3.Response.Builder()
            .code(400)
            .message("Bad Request")
            .protocol(okhttp3.Protocol.HTTP_1_1)
            .request(okhttp3.Request.Builder().url("http://localhost/").build())
            .headers(headers)
            .build())
        }

        val error = errorParser.parse(HttpException(response))

        assertTrue(error is AppError.Validation)
        val validationError = error as AppError.Validation
        assertEquals("Giá trị không hợp lệ.", validationError.fieldErrors["phone"])
        assertEquals("Giá trị không hợp lệ.", validationError.fieldErrors["fullName"])
        assertEquals("Dữ liệu yêu cầu không hợp lệ.", validationError.message)
        assertEquals("corr-abc-123", validationError.correlationId)
        assertEquals(400, validationError.httpStatus)
    }

    @Test
    fun parse_http429_withRetryAfterHeader_extractsRetryDelay() {
        val errorJson = """{"status": 429, "message": "Rate limit exceeded"}"""
        val headers = Headers.Builder()
            .add("Retry-After", "120")
            .add("X-Correlation-ID", "corr-rate-limit")
            .build()

        val rawResponse = okhttp3.Response.Builder()
            .code(429)
            .message("Too Many Requests")
            .protocol(okhttp3.Protocol.HTTP_1_1)
            .request(okhttp3.Request.Builder().url("http://localhost/").build())
            .headers(headers)
            .build()

        val response = Response.error<Any>(
            errorJson.toResponseBody("application/json".toMediaType()),
            rawResponse
        )
        val error = errorParser.parse(HttpException(response))

        assertTrue(error is AppError.RateLimited)
        val rateLimited = error as AppError.RateLimited
        assertEquals(120L, rateLimited.retryAfterSeconds)
        assertEquals("corr-rate-limit", rateLimited.correlationId)
        assertEquals(429, rateLimited.httpStatus)
    }

    @Test
    fun parse_http422_preservesExactValidationStatus() {
        val response = Response.error<Any>(
            422,
            """{"status":422,"message":"raw backend validation detail"}"""
                .toResponseBody("application/json".toMediaType())
        )

        val error = errorParser.parse(HttpException(response)) as AppError.Validation

        assertEquals(422, error.httpStatus)
        assertEquals("Dữ liệu yêu cầu không hợp lệ.", error.message)
    }

    @Test
    fun parse_http500_mapsToServer() {
        val errorJson = """{"status": 500, "message": "Database deadlock"}"""
        val response = Response.error<Any>(
            500,
            errorJson.toResponseBody("application/json".toMediaType())
        )
        val error = errorParser.parse(HttpException(response))

        assertTrue(error is AppError.Server)
        val serverError = error as AppError.Server
        assertEquals(500, serverError.code)
    }

    @Test
    fun parse_http503_mapsToServerUnavailable() {
        val errorJson = """{"status": 503, "message": "Service Temporarily Unavailable"}"""
        val response = Response.error<Any>(
            503,
            errorJson.toResponseBody("application/json".toMediaType())
        )
        val error = errorParser.parse(HttpException(response))

        assertTrue(error is AppError.ServerUnavailable)
        val serverError = error as AppError.ServerUnavailable
        assertEquals(503, serverError.code)
    }

    @Test
    fun parse_htmlOrPlainText502_doesNotThrow_andFallsBackToServerUnavailable() {
        val htmlBody = "<html><body><h1>502 Bad Gateway</h1></body></html>"
        val response = Response.error<Any>(
            502,
            htmlBody.toResponseBody("text/html".toMediaType())
        )
        val error = errorParser.parse(HttpException(response))

        assertTrue(error is AppError.ServerUnavailable)
        val serverError = error as AppError.ServerUnavailable
        assertEquals(502, serverError.code)
    }

    @Test
    fun parse_unknownThrowable_doesNotExposeRawExceptionMessageOrCause() {
        val secretDiagnostic = "database password leaked in stack trace"

        val error = errorParser.parse(IllegalStateException(secretDiagnostic))

        assertTrue(error is AppError.Unknown)
        assertEquals("Đã có lỗi không xác định xảy ra.", error.message)
        assertNull(error.cause)
        assertTrue(!error.message.contains(secretDiagnostic))
    }

    @Test
    fun parse_http429_withUnboundedRetryAfter_ignoresUnsafeValue() {
        val headers = Headers.Builder().add("Retry-After", "999999999").build()
        val rawResponse = okhttp3.Response.Builder()
            .code(429)
            .message("Too Many Requests")
            .protocol(okhttp3.Protocol.HTTP_1_1)
            .request(okhttp3.Request.Builder().url("http://localhost/").build())
            .headers(headers)
            .build()
        val response = Response.error<Any>("{}".toResponseBody("application/json".toMediaType()), rawResponse)

        val error = errorParser.parse(HttpException(response)) as AppError.RateLimited

        assertNull(error.retryAfterSeconds)
    }
}
