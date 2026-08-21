package com.flashticket.mobile.core.auth

import com.flashticket.mobile.core.model.UserProfile
import com.flashticket.mobile.core.network.ErrorParser
import com.flashticket.mobile.core.network.UserApiService
import com.flashticket.mobile.core.network.toDomain
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

interface UserRepository {
    suspend fun getCurrentUserProfile(): Result<UserProfile>
}

@Singleton
class UserRepositoryImpl @Inject constructor(
    private val userApiService: UserApiService,
    private val errorParser: ErrorParser
) : UserRepository {

    override suspend fun getCurrentUserProfile(): Result<UserProfile> = withContext(Dispatchers.IO) {
        try {
            val dto = userApiService.getCurrentUser()
            Result.success(dto.toDomain())
        } catch (exception: CancellationException) {
            throw exception
        } catch (e: Exception) {
            val appError = errorParser.parse(e)
            Result.failure(appError)
        }
    }
}
