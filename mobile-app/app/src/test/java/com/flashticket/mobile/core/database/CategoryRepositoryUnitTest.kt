package com.flashticket.mobile.core.database

import com.flashticket.mobile.core.model.AppError
import com.flashticket.mobile.core.network.CategoryApiService
import com.flashticket.mobile.core.network.CategoryResponseDto
import com.flashticket.mobile.core.network.ErrorParser
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.concurrent.atomic.AtomicInteger

class CategoryRepositoryUnitTest {

    private val nowMillis = 1_800_000_000_000L

    private class FakeCategoryDao : CategoryDao {
        val storedCategories = mutableListOf<CategoryEntity>()
        private val flow = MutableStateFlow<List<CategoryEntity>>(emptyList())

        override fun getAllCategories(): Flow<List<CategoryEntity>> {
            flow.value = storedCategories
            return flow
        }

        override suspend fun getCategoryCount(): Int = storedCategories.size

        override suspend fun insertCategories(categories: List<CategoryEntity>) {
            storedCategories.clear()
            storedCategories.addAll(categories)
            flow.value = storedCategories
        }

        override suspend fun clearAll() {
            storedCategories.clear()
            flow.value = emptyList()
        }
    }

    private class FakeCategoryApiService : CategoryApiService {
        var networkCategories = listOf(
            CategoryResponseDto(id = "c-1", name = "Music", slug = "music", displayOrder = 1),
            CategoryResponseDto(id = "c-2", name = "Sports", slug = "sports", displayOrder = 2)
        )
        val networkCallCount = AtomicInteger(0)
        var shouldThrow = false
        var throwable: Exception? = null

        override suspend fun getCategories(): List<CategoryResponseDto> {
            networkCallCount.incrementAndGet()
            throwable?.let { throw it }
            if (shouldThrow) throw IOException("Network offline")
            return networkCategories
        }
    }

    private lateinit var fakeDao: FakeCategoryDao
    private lateinit var fakeApi: FakeCategoryApiService
    private lateinit var errorParser: ErrorParser
    private lateinit var repository: CategoryRepositoryImpl

    @Before
    fun setUp() {
        fakeDao = FakeCategoryDao()
        fakeApi = FakeCategoryApiService()
        val json = Json { ignoreUnknownKeys = true }
        errorParser = ErrorParser(json)
        val clock = Clock.fixed(Instant.ofEpochMilli(nowMillis), ZoneOffset.UTC)
        repository = CategoryRepositoryImpl(fakeDao, fakeApi, errorParser, clock)
    }

    @Test
    fun getCategories_whenCacheValid_returnsCachedDataWithoutCallingNetwork() = runTest {
        // Gieo cache hợp lệ vừa mới lưu (1 phút trước)
        val cached = listOf(
            CategoryEntity(id = "c-cached", name = "Cached Music", slug = "music", cachedAt = nowMillis - 60_000L)
        )
        fakeDao.insertCategories(cached)

        val result = repository.getCategories(forceRefresh = false)

        assertTrue(result.isSuccess)
        val cacheResult = result.getOrThrow()
        assertEquals(1, cacheResult.categories.size)
        assertEquals("Cached Music", cacheResult.categories[0].name)
        assertEquals(CacheFreshness.FRESH, cacheResult.freshness)
        assertEquals(nowMillis - 60_000L, cacheResult.lastUpdatedMillis)
        // Không gọi network vì cache còn hạn (TTL 24h)
        assertEquals(0, fakeApi.networkCallCount.get())
    }

    @Test
    fun getCategories_whenCacheExpired_fetchesNetworkAndUpdatesCache() = runTest {
        // Gieo cache đã hết hạn (25 giờ trước)
        val expired = listOf(
            CategoryEntity(id = "c-old", name = "Old Music", slug = "music", cachedAt = nowMillis - (25 * 3600 * 1000L))
        )
        fakeDao.insertCategories(expired)

        val result = repository.getCategories(forceRefresh = false)

        assertTrue(result.isSuccess)
        val cacheResult = result.getOrThrow()
        assertEquals(2, cacheResult.categories.size)
        assertEquals("Music", cacheResult.categories[0].name)
        assertEquals(CacheFreshness.FRESH, cacheResult.freshness)
        assertEquals(nowMillis, cacheResult.lastUpdatedMillis)
        assertEquals(1, fakeApi.networkCallCount.get())
    }

    @Test
    fun getCategories_whenNetworkFailsAndCacheExists_returnsCachedFallback() = runTest {
        val cached = listOf(
            CategoryEntity(id = "c-fallback", name = "Fallback Music", slug = "music", cachedAt = nowMillis - (25 * 3600 * 1000L))
        )
        fakeDao.insertCategories(cached)
        fakeApi.shouldThrow = true

        val result = repository.getCategories(forceRefresh = false)

        assertTrue(result.isSuccess)
        val cacheResult = result.getOrThrow()
        assertEquals("Fallback Music", cacheResult.categories[0].name)
        assertEquals(CacheFreshness.STALE, cacheResult.freshness)
        assertEquals(nowMillis - (25 * 3600 * 1000L), cacheResult.lastUpdatedMillis)
    }

    @Test
    fun getCategories_whenNetworkFailsAndCacheEmpty_returnsFailure() = runTest {
        fakeDao.clearAll()
        fakeApi.shouldThrow = true

        val result = repository.getCategories(forceRefresh = false)

        assertTrue(result.isFailure)
        val error = result.exceptionOrNull()
        assertTrue(error is AppError.NetworkUnavailable)
    }

    @Test(expected = CancellationException::class)
    fun getCategories_whenRequestIsCancelled_rethrowsCancellation() = runTest {
        fakeApi.throwable = CancellationException("Cancelled")

        repository.getCategories(forceRefresh = true)
    }

    @Test
    fun getCategories_whenUnexpectedFailureAndCacheExists_doesNotHideContractRegression() = runTest {
        fakeDao.insertCategories(
            listOf(CategoryEntity(id = "cached", name = "Cached", slug = "cached", cachedAt = 0L))
        )
        fakeApi.throwable = IllegalStateException("Broken mapper")

        val result = repository.getCategories(forceRefresh = true)

        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is AppError.Unknown)
    }
}
