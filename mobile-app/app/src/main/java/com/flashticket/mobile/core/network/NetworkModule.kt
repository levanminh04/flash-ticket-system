package com.flashticket.mobile.core.network

import com.flashticket.mobile.BuildConfig
import com.flashticket.mobile.core.auth.AuthSessionController
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import okhttp3.Authenticator
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.http.GET
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

interface UserApiService {
    @RetryPolicyTag(RetryPolicy.SAFE_READ)
    @TimeoutPolicyTag(TimeoutType.DEFAULT_READ)
    @GET("/api/users/me")
    suspend fun getCurrentUser(): UserResponseDto
}

interface CategoryApiService {
    @RetryPolicyTag(RetryPolicy.SAFE_READ)
    @TimeoutPolicyTag(TimeoutType.DEFAULT_READ)
    @GET("/api/categories")
    suspend fun getCategories(): List<CategoryResponseDto>
}

class AuthInterceptor(
    private val authSessionController: AuthSessionController
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val requestBuilder = chain.request().newBuilder()
        val token = runBlocking { authSessionController.getValidAccessToken() }
        if (!token.isNullOrBlank()) {
            requestBuilder.header("Authorization", "Bearer $token")
        }
        return chain.proceed(requestBuilder.build())
    }
}

/**
 * Xử lý HTTP 401 challenge: tự động double-checked refresh token và retry request; nếu refresh thất bại thì kết thúc session theo ADR-004 & ADR-005.
 */
class TokenAuthenticator(
    private val authSessionController: AuthSessionController
) : Authenticator {

    override fun authenticate(route: Route?, response: Response): Request? {
        // Tránh vòng lặp retry vô tận khi backend liên tục trả về 401
        if (responseCount(response) >= 2) {
            return null
        }

        val originalHeader = response.request.header("Authorization")
        val failedToken = originalHeader?.removePrefix("Bearer ")?.trim()
        val freshToken = runBlocking { authSessionController.refreshAccessToken(failedToken) }

        if (freshToken.isNullOrBlank()) {
            // Refresh thất bại -> Xóa local session và yêu cầu đăng nhập lại theo ADR-005
            runBlocking { authSessionController.logout() }
            return null
        }

        val newHeader = "Bearer $freshToken"
        if (newHeader == originalHeader) {
            // Token mới lấy không thay đổi -> ngừng retry
            return null
        }

        return response.request.newBuilder()
            .header("Authorization", newHeader)
            .build()
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }
}

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        isLenient = false
        encodeDefaults = false
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(authSessionController: AuthSessionController): OkHttpClient {
        val builder = OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .addInterceptor(DynamicTimeoutInterceptor())
            .addInterceptor(SafeRetryInterceptor())
            .addInterceptor(CorrelationIdInterceptor())
            .addInterceptor(AppMetadataInterceptor())
            .addInterceptor(AuthInterceptor(authSessionController))
            .authenticator(TokenAuthenticator(authSessionController))

        if (BuildConfig.DEBUG) {
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.HEADERS // HEADERS instead of BODY to protect PII
                redactHeader("Authorization")
                redactHeader("Cookie")
                redactHeader("Set-Cookie")
            }
            builder.addInterceptor(logging)
        }

        return builder.build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient, json: Json): Retrofit {
        val contentType = "application/json".toMediaType()
        return Retrofit.Builder()
            .baseUrl(BuildConfig.GATEWAY_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(json.asConverterFactory(contentType))
            .build()
    }

    @Provides
    @Singleton
    fun provideUserApiService(retrofit: Retrofit): UserApiService {
        return retrofit.create(UserApiService::class.java)
    }

    @Provides
    @Singleton
    fun provideCategoryApiService(retrofit: Retrofit): CategoryApiService {
        return retrofit.create(CategoryApiService::class.java)
    }
}
