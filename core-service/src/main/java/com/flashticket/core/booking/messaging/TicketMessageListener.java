package com.flashticket.core.booking.messaging;

import com.flashticket.core.booking.entity.Order;
import com.flashticket.core.booking.entity.Ticket;
import com.flashticket.core.booking.repository.OrderRepository;
import com.flashticket.core.common.exception.ResourceNotFoundException;
import com.flashticket.core.notification.service.QRCodeService;
import com.flashticket.core.booking.service.TicketIssuanceService;
import com.flashticket.core.shared.messaging.RabbitMQConstants;
import com.flashticket.core.shared.event.PaymentSuccessEvent;
import com.flashticket.core.shared.event.TicketIssuedEvent;
import com.rabbitmq.client.Channel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.List;

/**
 * Consumer: Lắng nghe Queue {@code q.ticket.issue} và cấp vé sau khi thanh toán thành công.
 *
 * <p>Quy trình:
 * 1. Gọi {@link TicketIssuanceService} để tạo record vé trong DB.
 * 2. Gọi {@link QRCodeService} để sinh ảnh QR và upload lên Cloudinary.
 * 3. Publish {@link TicketIssuedEvent} để gửi email xác nhận.
 *
 * <p>Manual ACK được sử dụng để đảm bảo tính an toàn dữ liệu.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TicketMessageListener {

    private final TicketIssuanceService ticketIssuanceService;
    private final QRCodeService qrCodeService;
    private final RabbitTemplate rabbitTemplate;
    private final OrderRepository orderRepository;

    @RabbitListener(queues = RabbitMQConstants.QUEUE_TICKET_ISSUE)
    public void handlePaymentSuccess(
        PaymentSuccessEvent event, // Spring tự động deserialize PaymentSuccessEvent JSON bytes → Java object
        Channel channel,           // kênh AMQP giữa app và RabbitMQ. Cần thiết khi AcknowledgeMode.MANUAL để tự tay gọi ACK/NACK
        @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag // Mỗi message RabbitMQ gửi đến có kèm metadata trong header, `DELIVERY_TAG` là định danh duy nhất của message đó trong channel hiện tại. Dùng để báo cho RabbitMQ biết chính xác message nào đang được ACK/NACK:

    ) throws IOException {

        log.info("[TicketWorker] Received PaymentSuccessEvent — orderId={}", event.orderId());

        try {
            // Bước 1: Cấp vé trong Database
            List<Ticket> tickets = ticketIssuanceService.issueTickets(event.orderId());

            // Bước 2: Sinh ảnh QR và upload lên Cloudinary (Optimal for Email & UI)
            qrCodeService.generateAndUploadForTickets(tickets); // tickets  đi qua hàm này sẽ bị thay  đổi (do truyền object, truyền int, long thì khong làm được điều này

            // Lấy thêm thông tin Order để đóng gói vào Event
            Order order = orderRepository.findById(event.orderId())
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + event.orderId()));

            List<TicketIssuedEvent.TicketDto> ticketDtos = tickets.stream()
                .map(t -> new TicketIssuedEvent.TicketDto(
                    t.getId(),
                    t.getTicketCode(),
                    t.getSeatLabel(),
                    t.getTicketTypeName() != null ? t.getTicketTypeName() : "Standard",
                    t.getQrCodeImageUrl(),
                    t.getHolderName()
                )).toList();

            TicketIssuedEvent ticketEvent = new TicketIssuedEvent(
                order.getId(),
                order.getCustomerEmail(),
                order.getCustomerName(),
                order.getEventTitle(),
                order.getEventVenueName(),
                order.getEventStartDatetime(),
                order.getOrderNumber(),
                ticketDtos
            );

            // Bước 3: Sau khi hoàn tất issuance + upload → trigger Email Worker
            rabbitTemplate.convertAndSend(
                RabbitMQConstants.EXCHANGE_TICKET,
                RabbitMQConstants.RK_TICKET_ISSUED,
                ticketEvent
            );

            log.info("[TicketWorker] Tickets issued & QR images uploaded & Event published — orderId={}", event.orderId());

            // ACK — RabbitMQ xoá message khỏi Queue
            // ACK — message xử lý thành công mới gửi ACK
            // mặc định không cấu hình (AcknowledgeMode.AUTO) thì nhận message là ack. như vậy sẽ nguy hiểm vì có thể issue ticket bị lỗi giữa chừng thì sẽ không còn event trong queue để xử lý lại nữa
            channel.basicAck(deliveryTag, false); // deliveryTag | long | ID của message cần ACK |

            /**
             * Ví dụ thực tế: Giống như việc bạn xem truyền hình cáp. Chỉ có một sợi dây cáp đồng trục đi vào nhà bạn (TCP Connection),
             * nhưng bên trong đó có hàng trăm kênh (Channel) HBO, Disney, VTV... Bạn chuyển kênh tức là bạn đang chọn xem dữ liệu của "Channel ID" nào đó đang chạy trên cùng một sợi dây.
             * */
        } catch (Exception e) {
            log.error("[TicketWorker] Failed to process ticket issuance — orderId={}: {}",
                event.orderId(), e.getMessage(), e);

            // NACK + requeue=false → RabbitMQ chuyển vào Dead-Letter Queue
            channel.basicNack(deliveryTag, false, false);
//            requeue=true:   trả message về đầu queue → consumer nhận lại → retry
//            requeue=false:  không requeue → có DLX thì vào DLQ, không có thì mất
        }
    }
}
