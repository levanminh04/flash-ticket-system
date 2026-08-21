package com.flashticket.mobile.feature.scanner

import androidx.annotation.OptIn
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage

sealed interface CheckInOutcome {
    data class Valid(
        val ticketCode: String,
        val holderName: String,
        val ticketTypeName: String,
        val seatLabel: String?,
        val checkedInAt: String
    ) : CheckInOutcome

    data class AlreadyUsed(val message: String) : CheckInOutcome
    data class InvalidSignature(val message: String) : CheckInOutcome
    data class NotFound(val message: String) : CheckInOutcome
    data class InvalidStatus(val message: String) : CheckInOutcome
    data class Unknown(val rawMessage: String?) : CheckInOutcome
}

object CheckInOutcomeAdapter {
    /**
     * Chuyển đổi phản hồi lỗi chuỗi tiếng Việt từ backend thành Sealed Interface CheckInOutcome.
     * Technical Debt: Backend chưa cung cấp machine-readable reasonCode/decision.
     */
    fun fromErrorResponse(statusCode: Int, rawMessage: String?): CheckInOutcome {
        val msg = rawMessage ?: ""
        return when {
            msg.contains("đã được sử dụng", ignoreCase = true) -> CheckInOutcome.AlreadyUsed(msg)
            msg.contains("chỉnh sửa", ignoreCase = true) || msg.contains("giả mạo", ignoreCase = true) -> CheckInOutcome.InvalidSignature(msg)
            msg.contains("không tồn tại", ignoreCase = true) -> CheckInOutcome.NotFound(msg)
            msg.contains("không hợp lệ", ignoreCase = true) -> CheckInOutcome.InvalidStatus(msg)
            else -> CheckInOutcome.Unknown(rawMessage)
        }
    }
}

class QrCodeAnalyzer(
    private val onQrDetected: (String) -> Unit
) : ImageAnalysis.Analyzer {

    private val scanner = BarcodeScanning.getClient(
        BarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build()
    )

    private var isPaused = false
    private var lastScannedCode: String? = null
    private var lastScannedTimestamp: Long = 0L

    fun setPaused(paused: Boolean) {
        isPaused = paused
    }

    fun close() {
        scanner.close()
    }

    @OptIn(ExperimentalGetImage::class)
    override fun analyze(imageProxy: ImageProxy) {
        if (isPaused) {
            imageProxy.close()
            return
        }

        val mediaImage = imageProxy.image
        if (mediaImage != null) {
            val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)
            scanner.process(image)
                .addOnSuccessListener { barcodes ->
                    for (barcode in barcodes) {
                        val rawValue = barcode.rawValue
                        if (!rawValue.isNullOrBlank()) {
                            val now = System.currentTimeMillis()
                            if (rawValue != lastScannedCode || now - lastScannedTimestamp > 2000L) {
                                lastScannedCode = rawValue
                                lastScannedTimestamp = now
                                onQrDetected(rawValue)
                            }
                            break
                        }
                    }
                }
                .addOnCompleteListener {
                    imageProxy.close()
                }
        } else {
            imageProxy.close()
        }
    }
}
