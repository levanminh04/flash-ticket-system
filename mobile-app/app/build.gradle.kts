import java.net.URI

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
}

val acceptedCleartextProductionHost = "15.134.248.39"
val defaultProductionGatewayUrl = "http://$acceptedCleartextProductionHost/"
val defaultProductionIssuerUrl = "http://$acceptedCleartextProductionHost/auth/realms/flash-ticket"

val productionGatewayUrl = providers.gradleProperty("PROD_GATEWAY_BASE_URL")
    .orElse(providers.environmentVariable("PROD_GATEWAY_BASE_URL"))
    .orElse(defaultProductionGatewayUrl)
val productionIssuerUrl = providers.gradleProperty("PROD_KEYCLOAK_ISSUER_URL")
    .orElse(providers.environmentVariable("PROD_KEYCLOAK_ISSUER_URL"))
    .orElse(defaultProductionIssuerUrl)

android {
    namespace = "com.flashticket.mobile"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.flashticket.mobile"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        
        manifestPlaceholders["appAuthRedirectScheme"] = "com.flashticket.mobile"
    }

    buildTypes {
        debug {
            isMinifyEnabled = false
            buildConfigField("String", "GATEWAY_BASE_URL", "\"${productionGatewayUrl.get()}\"")
            buildConfigField("String", "KEYCLOAK_ISSUER_URL", "\"${productionIssuerUrl.get()}\"")
            buildConfigField("String", "KEYCLOAK_CLIENT_ID", "\"flash-ticket-android\"")
            buildConfigField("String", "ALLOWED_CLEARTEXT_HOST", "\"$acceptedCleartextProductionHost\"")
        }
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            buildConfigField("String", "GATEWAY_BASE_URL", "\"${productionGatewayUrl.get()}\"")
            buildConfigField("String", "KEYCLOAK_ISSUER_URL", "\"${productionIssuerUrl.get()}\"")
            buildConfigField("String", "KEYCLOAK_CLIENT_ID", "\"flash-ticket-android\"")
            buildConfigField("String", "ALLOWED_CLEARTEXT_HOST", "\"$acceptedCleartextProductionHost\"")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }

    kotlinOptions {
        jvmTarget = "21"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    lint {
        abortOnError = true
        checkDependencies = true
        ignoreTestSources = true
    }
}

val validateProductionConfiguration by tasks.registering {
    group = "verification"
    description = "Validates remote production URLs before Android builds."

    doLast {
        fun requireProductionUrl(name: String, value: String, requireTrailingSlash: Boolean = false) {
            require(value.isNotBlank()) {
                "$name is required. Set it as a Gradle property or environment variable."
            }
            val uri = runCatching { URI(value) }.getOrElse {
                throw GradleException("$name must be a valid absolute URL.")
            }
            val isHttps = uri.scheme.equals("https", ignoreCase = true)
            val isAcceptedHttp = uri.scheme.equals("http", ignoreCase = true) &&
                uri.host.equals(acceptedCleartextProductionHost, ignoreCase = true)
            require((isHttps || isAcceptedHttp) && !uri.host.isNullOrBlank()) {
                "$name must use HTTPS or the explicitly accepted HTTP production host $acceptedCleartextProductionHost."
            }
            require(uri.userInfo == null && uri.query == null && uri.fragment == null) {
                "$name must not contain user info, query parameters, or fragments."
            }
            require(!requireTrailingSlash || value.endsWith('/')) {
                "$name must end with '/'."
            }
        }

        requireProductionUrl("PROD_GATEWAY_BASE_URL", productionGatewayUrl.get(), requireTrailingSlash = true)
        requireProductionUrl("PROD_KEYCLOAK_ISSUER_URL", productionIssuerUrl.get())
    }
}

tasks.matching { it.name == "preDebugBuild" || it.name == "preReleaseBuild" }.configureEach {
    dependsOn(validateProductionConfiguration)
}

dependencies {
    // Compose BOM & UI
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.navigation.compose)

    // Hilt Dependency Injection
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.androidx.hilt.navigation.compose)

    // Network & Serialization
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.kotlinx.serialization)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging.interceptor)
    implementation(libs.kotlinx.serialization.json)

    // Auth & Security
    implementation(libs.appauth)
    implementation(libs.androidx.security.crypto)

    // Room Database & DataStore
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)
    implementation(libs.androidx.datastore.preferences)

    // Camera & Scanner
    implementation(libs.androidx.camera.core)
    implementation(libs.androidx.camera.camera2)
    implementation(libs.androidx.camera.lifecycle)
    implementation(libs.androidx.camera.view)
    implementation(libs.google.mlkit.barcode.scanning)

    // Image Loading & Async
    implementation(libs.coil.compose)
    implementation(libs.kotlinx.coroutines.android)

    // Testing
    testImplementation(libs.junit)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver)
    androidTestImplementation(libs.androidx.test.ext.junit)
    androidTestImplementation(libs.androidx.test.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
}
