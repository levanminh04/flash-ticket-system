package com.flashticket.mobile.core.auth

import com.flashticket.mobile.core.model.AppError
import com.flashticket.mobile.core.model.UserProfile
import com.flashticket.mobile.core.network.UserApiService
import com.flashticket.mobile.core.network.toDomain
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

interface UserRepository {
    suspend fun getCurrentUserProfile(): Result<UserProfile>
}

@Singleton
class UserRepositoryImpl @Inject constructor(
    private val userApiService: UserApiService
) : UserRepository {

    override suspend fun getCurrentUserProfile(): Result<UserProfile> = withContext(Dispatchers.IO) {
        try {
            val dto = userApiService.getCurrentUser()
            Result.success(dto.toDomain())
        } catch (e: HttpException) {
            val error = when (e.code()) {
                401 -> AppError.SessionExpired("Phiên đăng nhập đã hết hạn.", e)
                403 -> AppError.Forbidden("Bạn không có quyền truy cập thông tin này.", e)
                404 -> AppError.NotFound("User", "me", "Không tìm thấy thông tin người dùng.", e)
                else -> AppError.ServerUnavailable("Lỗi máy chủ (${e.code()}). Vui lòng thử lại sau.", e)
            }
            Result.failure(error)
        } catch (e: IOException) {
            Result.failure(AppError.NetworkUnavailable("Không có kết nối mạng. Vui lòng kiểm tra lại.", e))
        } catch (e: Exception) {
            Result.failure(AppError.Unknown(e.message ?: "Không thể lấy thông tin người dùng.", e))
        }
    }
}
