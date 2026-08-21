package com.flashticket.mobile.core.auth

import com.flashticket.mobile.core.model.AppError
import com.flashticket.mobile.core.model.UserRole
import com.flashticket.mobile.core.network.UserApiService
import com.flashticket.mobile.core.network.UserResponseDto
import kotlinx.coroutines.test.runTest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response
import java.io.IOException

class UserRepositoryUnitTest {

    @Test
    fun getCurrentUserProfile_success_returnsMappedUserProfile() = runTest {
        val fakeService = object : UserApiService {
            override suspend fun getCurrentUser(): UserResponseDto {
                return UserResponseDto(
                    id = "user-123",
                    email = "test@example.com",
                    displayName = "Test User",
                    roles = listOf("ROLE_ORGANIZER")
                )
            }
        }

        val repo = UserRepositoryImpl(fakeService)
        val result = repo.getCurrentUserProfile()

        assertTrue(result.isSuccess)
        val profile = result.getOrThrow()
        assertEquals("user-123", profile.id)
        assertEquals("test@example.com", profile.email)
        assertEquals("Test User", profile.displayName)
        assertEquals(UserRole.ORGANIZER, profile.primaryRole)
    }

    @Test
    fun getCurrentUserProfile_http401_mapsToSessionExpired() = runTest {
        val fakeService = object : UserApiService {
            override suspend fun getCurrentUser(): UserResponseDto {
                val errorResponse = Response.error<UserResponseDto>(
                    401,
                    "Unauthorized".toResponseBody("application/json".toMediaType())
                )
                throw HttpException(errorResponse)
            }
        }

        val repo = UserRepositoryImpl(fakeService)
        val result = repo.getCurrentUserProfile()

        assertTrue(result.isFailure)
        val error = result.exceptionOrNull()
        assertTrue(error is AppError.SessionExpired)
    }

    @Test
    fun getCurrentUserProfile_http403_mapsToForbidden() = runTest {
        val fakeService = object : UserApiService {
            override suspend fun getCurrentUser(): UserResponseDto {
                val errorResponse = Response.error<UserResponseDto>(
                    403,
                    "Forbidden".toResponseBody("application/json".toMediaType())
                )
                throw HttpException(errorResponse)
            }
        }

        val repo = UserRepositoryImpl(fakeService)
        val result = repo.getCurrentUserProfile()

        assertTrue(result.isFailure)
        val error = result.exceptionOrNull()
        assertTrue(error is AppError.Forbidden)
    }

    @Test
    fun getCurrentUserProfile_ioException_mapsToNetworkUnavailable() = runTest {
        val fakeService = object : UserApiService {
            override suspend fun getCurrentUser(): UserResponseDto {
                throw IOException("Connection reset")
            }
        }

        val repo = UserRepositoryImpl(fakeService)
        val result = repo.getCurrentUserProfile()

        assertTrue(result.isFailure)
        val error = result.exceptionOrNull()
        assertTrue(error is AppError.NetworkUnavailable)
    }
}
