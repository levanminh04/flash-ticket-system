# Flash Ticket Mobile ProGuard Rules

# Kotlinx Serialization
-keepattributes *Annotation*,InnerClasses
-dontnote kotlinx.serialization.SerializationKt
-keepclassmembers class * {
    *** Companion;
}
-keepclasseswithmembers class * {
    kotlinx.serialization.KSerializer serializer(...);
}

# Retrofit & OkHttp
-dontnote retrofit2.Platform
-dontwarn okhttp3.**
-dontwarn okio.**

# AppAuth
-keep class net.openid.appauth.** { *; }

# Room
-keep class * extends androidx.room.RoomDatabase
-dontwarn androidx.room.paging.**

# CameraX & ML Kit
-keep class androidx.camera.core.** { *; }
-keep class com.google.mlkit.vision.barcode.** { *; }

# Coil
-dontwarn coil.**
