package com.flashticket.core.notification.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.flashticket.core.booking.entity.Ticket;
import com.flashticket.core.booking.repository.TicketRepository;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * QRCodeService — Xử lý tạo ảnh QR Code và upload lên Cloudinary.
 *
 * <p>Sử dụng thư viện ZXing để tạo ma trận điểm (BitMatrix) và Cloudinary để lưu trữ ảnh.
 * Ảnh phục vụ cho việc nhúng vào Email và hiển thị trên giao diện người dùng.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class QRCodeService {

    private final Cloudinary cloudinary;
    private final TicketRepository ticketRepository;

    private static final int QR_SIZE = 300; // 300x300 px là kích thước tối ưu cho mobile scan

    /**
     * Tạo ảnh QR và upload lên Cloudinary cho một danh sách vé.
     * Gọi bởi TicketMessageListener trong luồng hậu thanh toán.
     *
     * @param tickets Danh sách vé cần tạo ảnh QR
     */
    @Transactional
    public void generateAndUploadForTickets(Iterable<Ticket> tickets) {
        for (Ticket ticket : tickets) {
            try {
                if (ticket.getQrCodeImageUrl() != null) {
                    continue; // Skip nếu đã có ảnh (Idempotency)
                }

                String imageUrl = uploadToCloudinary(ticket);
                ticket.setQrCodeImageUrl(imageUrl);
                ticketRepository.save(ticket);

                log.info("Successfully generated and uploaded QR image for ticket {}", ticket.getTicketCode());
            } catch (Exception e) {
                // Ta không throw exception ở đây để tránh block toàn bộ các vé khác
                // Ticket nào lỗi sẽ được xử lý lại ở lần retry hoặc trigger thủ công
                log.error("Failed to generate/upload QR for ticket {}: {}", ticket.getTicketCode(), e.getMessage());
            }
        }
    }

    /**
     * Thực hiện tạo ảnh QR từ dữ liệu đã ký và upload.
     */
    private String uploadToCloudinary(Ticket ticket) throws Exception {
        byte[] qrImageBytes = generateQRCodeImage(ticket.getQrCodeData());

        Map<String, Object> uploadParams = ObjectUtils.asMap(
            "folder", "flash-ticket/tickets/" + ticket.getOrderId(),
            "public_id", ticket.getTicketCode(), //  ép Cloudinary  dùng  mã vé làm tên file định danh (public_id)
            "resource_type", "image",
            "overwrite", true                    // đi kèm với public_id, nếu up thêm 1 lần nữa với public_id cũ thì ảnh cũ sẽ bị ghi đè, không để 1 ví có > 1 ảnh QR được
        );

        Map uploadResult = cloudinary.uploader().upload(qrImageBytes, uploadParams);
        return (String) uploadResult.get("secure_url");
    }

    /**
     * Tạo byte array của ảnh QR (format PNG) sử dụng ZXing.
     */
    private byte[] generateQRCodeImage(String data) throws Exception {
        QRCodeWriter qrCodeWriter = new QRCodeWriter();

        Map<EncodeHintType, Object> hints = new HashMap<>();
        hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
        hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M); // M = 15% recovery
        hints.put(EncodeHintType.MARGIN, 1);

        BitMatrix bitMatrix = qrCodeWriter.encode(data, BarcodeFormat.QR_CODE, QR_SIZE, QR_SIZE, hints);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(bitMatrix, "PNG", baos);
        return baos.toByteArray();
    }
}
