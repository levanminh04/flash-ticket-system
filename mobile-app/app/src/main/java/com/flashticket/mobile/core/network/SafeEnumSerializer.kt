package com.flashticket.mobile.core.network

import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

/**
 * Custom Serializer an toàn cho Enum ngoài boundary API theo ADR-004:
 * Khi nhận được một giá trị enum chưa biết từ backend (ví dụ giá trị mới thêm trong tương lai),
 * tự động map về giá trị fallback [default] thay vì ném ra SerializationException gây crash app.
 */
abstract class SafeEnumSerializer<T : Enum<T>>(
    serialName: String,
    private val enumEntries: Array<T>,
    private val default: T
) : KSerializer<T> {

    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor(serialName, PrimitiveKind.STRING)

    override fun serialize(encoder: Encoder, value: T) {
        encoder.encodeString(value.name)
    }

    override fun deserialize(decoder: Decoder): T {
        val rawValue = decoder.decodeString()
        return enumEntries.firstOrNull { it.name.equals(rawValue, ignoreCase = true) } ?: default
    }
}
