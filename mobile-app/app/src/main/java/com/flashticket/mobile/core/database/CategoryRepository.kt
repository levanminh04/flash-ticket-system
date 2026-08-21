package com.flashticket.mobile.core.database

import com.flashticket.mobile.core.model.AppError
import com.flashticket.mobile.core.model.Category
import com.flashticket.mobile.core.network.CategoryApiService
import com.flashticket.mobile.core.network.ErrorParser
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import java.time.Clock
import javax.inject.Inject
import javax.inject.Singleton

interface CategoryRepository {
    suspend fun getCategories(forceRefresh: Boolean = false): Result<CategoryCacheResult>
}

enum class CacheFreshness { FRESH, STALE }

data class CategoryCacheResult(
    val categories: List<Category>,
    val freshness: CacheFreshness,
    val lastUpdatedMillis: Long
)

@Singleton
class CategoryRepositoryImpl @Inject constructor(
    private val categoryDao: CategoryDao,
    private val categoryApiService: CategoryApiService,
    private val errorParser: ErrorParser,
    private val clock: Clock
) : CategoryRepository {

    override suspend fun getCategories(forceRefresh: Boolean): Result<CategoryCacheResult> = withContext(Dispatchers.IO) {
        val cachedEntities = categoryDao.getAllCategories().first()
        val latestCachedAt = cachedEntities.maxOfOrNull { it.cachedAt } ?: 0L
        val isCacheValid = cachedEntities.isNotEmpty() &&
            !CachePolicy.Category.isExpired(latestCachedAt, clock.millis())

        if (isCacheValid && !forceRefresh) {
            return@withContext Result.success(
                CategoryCacheResult(
                    categories = cachedEntities.map { it.toDomain() },
                    freshness = CacheFreshness.FRESH,
                    lastUpdatedMillis = latestCachedAt
                )
            )
        }

        try {
            val remoteDtos = categoryApiService.getCategories()
            val fetchedAt = clock.millis()
            val entities = remoteDtos.map { it.toEntity(fetchedAt) }
            categoryDao.replaceAll(entities)
            Result.success(
                CategoryCacheResult(
                    categories = entities.map { it.toDomain() },
                    freshness = CacheFreshness.FRESH,
                    lastUpdatedMillis = fetchedAt
                )
            )
        } catch (exception: CancellationException) {
            throw exception
        } catch (exception: Exception) {
            val parsedError = errorParser.parse(exception)
            if (cachedEntities.isNotEmpty() && parsedError.isRecoverableForCacheFallback()) {
                Result.success(
                    CategoryCacheResult(
                        categories = cachedEntities.map { it.toDomain() },
                        freshness = CacheFreshness.STALE,
                        lastUpdatedMillis = latestCachedAt
                    )
                )
            } else {
                Result.failure(parsedError)
            }
        }
    }

    private fun AppError.isRecoverableForCacheFallback(): Boolean =
        this is AppError.NetworkUnavailable ||
            this is AppError.Timeout ||
            this is AppError.ServerUnavailable
}
