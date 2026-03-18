package com.flashticket.core.notification.service;

import com.flashticket.core.shared.event.TicketIssuedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * EmailService — Gửi email xác nhận vé sau khi Ticket được cấp thành công.
 *
 * <p>Được gọi bởi {@link com.flashticket.core.notification.messaging.EmailMessageListener}
 * sau khi nhận {@link com.flashticket.core.shared.event.TicketIssuedEvent} từ RabbitMQ.
 *
 * <p>Sử dụng Thymeleaf để render HTML template {@code email/ticket-confirmation.html}.
 * Idempotent: nếu gửi email thành công nhưng Worker crash trước lúc ACK,
 * lần retry sau sẽ gửi email trùng. Đây là trade-off chấp nhận được (at-least-once delivery).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;
    private final TemplateEngine templateEngine;

    @Value("${spring.mail.username}")
    private String fromEmail;

    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter EVENT_DATE_FMT =
        DateTimeFormatter.ofPattern("EEEE, dd/MM/yyyy · HH:mm", new Locale("vi")); // mẫu: Thứ Sáu, 20/10/2023 · 14:30

    /**
     * Gửi email xác nhận vé cho tất cả tickets của order.
     */
    public void sendTicketConfirmationEmail(TicketIssuedEvent event) {
        if (event.tickets() == null || event.tickets().isEmpty()) {
            log.warn("[EmailService] No tickets found for order {}, skipping email.", event.orderId());
            return;
        }

        String toEmail = event.customerEmail();
        if (toEmail == null || toEmail.isBlank()) {
            log.warn("[EmailService] Order {} has no customer email. Skipping.", event.orderId());
            return;
        }

        String subject = "🎉 Xác nhận đặt vé: " + event.eventTitle();
        String htmlBody = buildEmailBody(event);

        sendHtmlEmail(toEmail, subject, htmlBody);

        log.info("[EmailService] Sent ticket confirmation to {} for order {} ({} tickets)",
            toEmail, event.orderNumber(), event.tickets().size());
    }

    // ──────────────────────────────────────────────────────────────────────────

    private String buildEmailBody(TicketIssuedEvent event) {
        Context ctx = new Context(new Locale("vi"));

        // Dữ liệu event
        ctx.setVariable("holderName",   event.customerName() != null ? event.customerName() : "Quý khách");
        ctx.setVariable("eventTitle",   event.eventTitle());
        ctx.setVariable("venueName",    event.eventVenueName() != null ? event.eventVenueName() : "Chưa cập nhật");
        ctx.setVariable("orderNumber",  event.orderNumber());
        ctx.setVariable("ticketCount",  event.tickets().size());

        // Format ngày giờ sang múi giờ Việt Nam
        String formattedDatetime = event.eventStartDatetime() != null
            ? EVENT_DATE_FMT.format(event.eventStartDatetime().atZone(VN_ZONE))
            : "Chưa cập nhật";
        ctx.setVariable("eventDatetime", formattedDatetime);

        // Danh sách vé
        ctx.setVariable("tickets", event.tickets());

        return templateEngine.process("email/ticket-confirmation", ctx);
    }

    private void sendHtmlEmail(String to, String subject, String htmlBody) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail, "Flash Ticket");
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlBody, true); // true = isHtml
            mailSender.send(message);
        } catch (MessagingException | java.io.UnsupportedEncodingException e) {
            throw new RuntimeException("Gửi email thất bại tới " + to + ": " + e.getMessage(), e);
        }
    }
}
