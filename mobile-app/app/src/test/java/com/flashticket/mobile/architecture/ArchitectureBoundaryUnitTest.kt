package com.flashticket.mobile.architecture

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ArchitectureBoundaryUnitTest {

    @Test
    fun uiAndPresentationLayers_strictlyRespectRepositoryAndArchitectureBoundaries() {
        val possibleRootPaths = listOf(
            File("src/main/java/com/flashticket/mobile"),
            File("mobile-app/app/src/main/java/com/flashticket/mobile"),
            File("../mobile-app/app/src/main/java/com/flashticket/mobile")
        )
        val rootDir = possibleRootPaths.firstOrNull { it.exists() && it.isDirectory }
        assertTrue("Source directory must exist and be accessible for architecture test", rootDir != null && rootDir.exists())

        val presentationFiles = rootDir!!.walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .filter { file ->
                val relativePath = file.relativeTo(rootDir).invariantSeparatorsPath
                val source = file.readText()
                relativePath.startsWith("app/") ||
                    "/ui/" in "/$relativePath" ||
                    "/presentation/" in "/$relativePath" ||
                    "/navigation/" in "/$relativePath" ||
                    "@Composable" in source ||
                    "ViewModel" in source
            }
            .toList()

        assertTrue("At least one UI/presentation Kotlin file must be found", presentationFiles.isNotEmpty())

        val violations = mutableListOf<String>()

        presentationFiles.forEach { file ->
                    val lines = file.readLines()
                    lines.forEachIndexed { index, rawLine ->
                        val line = rawLine.trim()
                        if (line.startsWith("import ")) {
                            val importedClass = line.removePrefix("import ").trim()
                            // Quy tắc ranh giới kiến trúc (ADR-001 & P3.4):
                            // 1. Không import trực tiếp Room DAOs
                            if (importedClass.contains("core.database") && importedClass.endsWith("Dao")) {
                                violations.add("${file.name}:${index + 1} UI imports DAO: $importedClass")
                            }
                            // 2. Không import trực tiếp Room Entities
                            if (importedClass.contains("core.database") && importedClass.endsWith("Entity")) {
                                violations.add("${file.name}:${index + 1} UI imports Room Entity: $importedClass")
                            }
                            // 3. Không import trực tiếp Room Database
                            if (importedClass.contains("FlashTicketDatabase")) {
                                violations.add("${file.name}:${index + 1} UI imports Room Database: $importedClass")
                            }
                            // 4. Không import trực tiếp Retrofit API services hoặc retrofit2 annotations
                            if ((importedClass.contains("core.network") && importedClass.endsWith("ApiService")) ||
                                importedClass.startsWith("retrofit2.")
                            ) {
                                violations.add("${file.name}:${index + 1} UI imports Retrofit API service: $importedClass")
                            }
                            // 5. Không import trực tiếp Network DTOs
                            if (importedClass.contains("core.network") && importedClass.endsWith("Dto")) {
                                violations.add("${file.name}:${index + 1} UI imports Network DTO: $importedClass")
                            }
                        }
                    }
        }

        assertTrue("Presentation layer must not violate architecture boundaries (found ${violations.size} violations):\n" + violations.joinToString("\n"), violations.isEmpty())
    }
}
