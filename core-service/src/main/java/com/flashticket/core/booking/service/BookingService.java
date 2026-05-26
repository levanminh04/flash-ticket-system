package com.flashticket.core.booking.service;

import com.flashticket.core.booking.dto.*;
import com.flashticket.core.booking.entity.Order;
import com.flashticket.core.booking.entity.OrderItem;
import com.flashticket.core.booking.entity.OrderItemSeat;
import com.flashticket.core.booking.repository.OrderItemRepository;
import com.flashticket.core.booking.repository.OrderItemSeatRepository;
import com.flashticket.core.booking.repository.OrderRepository;
import com.flashticket.core.common.exception.InsufficientStockException;
import com.flashticket.core.common.exception.InvalidRequestException;
import com.flashticket.core.common.exception.ResourceNotFoundException;
import com.flashticket.core.event.entity.Event;
import com.flashticket.core.event.entity.TicketType;
import com.flashticket.core.event.entity.TicketType.InventoryMode;
import com.flashticket.core.event.repository.EventRepository;
import com.flashticket.core.event.repository.TicketTypeRepository;
import com.flashticket.core.event.service.TicketInventoryCounterService;
import com.flashticket.core.promotion.service.PromotionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.RBucket;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * BookingService — Core booking logic với Zone ticket mode.
 *
 * Flow chính:
 * 1. Duplicate booking guard (chặn user tạo 2 order PENDING cùng event)
 * 2. Validate Event (status, sale window, max per order)
 * 3. Validate từng TicketType (status, sale window, quantity limit)
 * 4. Redis Lock → Check stock → Atomic decrement
 * 5. reservePromotion() nếu có voucher
 * 6. Create Order + OrderItems
 *   → recordUsage KHÔNG gọi ở đây — PaymentService.handleIPN() gọi confirmPromotion()
 *
 * Pattern: Strategy (Zone vs Seat được route bởi ticket_type.seat_selection_enabled)
 * Phase 2D: Thêm SeatBookingStrategy.java — không sửa file này, chỉ thêm routing.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BookingService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final OrderItemSeatRepository orderItemSeatRepository;
    private final EventRepository eventRepository;
    private final TicketTypeRepository ticketTypeRepository;
    private final TicketInventoryCounterService ticketInventoryCounterService;
    private final TicketReservationService ticketReservationService;
    private final SeatBookingService seatBookingService;
    private final BookingCompositionPolicy bookingCompositionPolicy;
    private final PromotionService promotionService;
    private final RedissonClient redissonClient;

    // ══ ORDER EXPIRY
    private static final int ORDER_EXPIRY_MINUTES = 15;

    /**
     * Redis spam lock TTL — safety net phòng khi JVM crash trước khi finally chạy.
     * Trong điều kiện bình thường, key bị xóa ngay trong finally block (~200-500ms).
     * TTL 10s chỉ kick in khi server crash — sau đó user có thể thử lại bình thường.
     */
    private static final long BOOKING_SPAM_TTL_SECONDS = 10;

    // ══ CREATE BOOKING

    /**
     * Tạo booking mới — entry point.
     *
     * @Transactional đảm bảo fail → rollback tất cả DB changes.
     * Redis lock được release trong finally block — bên ngoài transaction boundary.
     */
    @Transactional
    public BookingResponse createBooking(BookingRequest request, String userId) {

        // ── Guard 0: Redis Spam Lock — Chặn TOCTOU race condition khi double-click
        //
        // Vấn đề: DB existsBy check + INSERT không atomic.
        // Nếu 2 request đến trong 1-5ms, cả 2 pass Guard 1 (false) rồi cùng INSERT → 2 orders.
        // RBucket.setIfAbsent() là atomic (Redis single-threaded) — chỉ 1 request win.
        //
        // Pattern từ pg_epm (production): setNx với TTL → xử lý → release trong finally.
        // Dùng Redisson RBucket (đã có sẵn RedissonClient) thay StringRedisTemplate để nhất quán.
        String spamKey = "booking:spam:" + userId + ":" + request.eventId();
        RBucket<String> spamBucket = redissonClient.getBucket(spamKey); //  tạo một Object ở Java để quản lý cái spamKey, chưa hề gọi đến Redis Server.
        boolean isFirst = spamBucket.setIfAbsent("1",
            Duration.ofSeconds(BOOKING_SPAM_TTL_SECONDS)); // GỬI LỆNH i lệnh SETNX (Set if Not Exists) ĐẾN REDIS SERVER

        if (!isFirst) {
            throw new InvalidRequestException(
                "Yêu cầu đặt vé đang được xử lý. Vui lòng chờ giây lát.");
        }

        try {
            return doBooking(request, userId);
        } finally {
            // Xóa key ngay sau khi xử lý xong — dù thành công hay thất bại.
            // Nếu thất bại → user được thử lại ngay; nếu thành công → Guard 1 DB chặn lần sau.
            spamBucket.delete();
        }
    }

    /**
     * Core booking logic — được gọi sau khi Redis spam lock đã acquire.
     *
     * @Transactional đảm bảo fail → rollback tất cả DB changes.
     * Redis RLock được release trong finally block — bên ngoài transaction boundary.
     *
     * Lưu ý self-invocation: method này phải là package-private hoặc được gọi
     * qua Spring proxy. Hiện tại dùng ApplicationContext.getBean() để tránh bypass AOP.
     * Cách đơn giản nhất: inject chính BookingService vào itself (Spring hỗ trợ lazy inject).
     *
     * TODO Phase sau: nếu cần @Transactional riêng, tách BookingTransactionService.
     * Hiện tại: @Transactional trên createBooking() đã bao toàn bộ — doBooking() không cần thêm.
     */
    BookingResponse doBooking(BookingRequest request, String userId) {

        // ── Guard 1: Chặn duplicate booking (user đã có PENDING order cho event này)
        // Ngăn user spam F5 hoặc double-click tạo nhiều order cùng lúc
        if (orderRepository.existsByUserIdAndEventIdAndStatusAndIsDeletedFalse(
                userId, request.eventId(), Order.OrderStatus.PENDING)) {
            throw new InvalidRequestException(
                "Bạn đang có 1 đơn hàng chờ thanh toán cho sự kiện này. " +
                "Vui lòng hoàn tất thanh toán hoặc hủy đơn cũ trước.");
        }

        // Load & Validate Event
        Event event = eventRepository.findByIdAndIsDeletedFalse(request.eventId())
            .orElseThrow(() -> new ResourceNotFoundException("Sự kiện không tồn tại"));

        validateEvent(event, request);

        // Load & Validate Ticket Types
        List<BookingItemContext> contexts = buildAndValidateContexts(request, event);
        bookingCompositionPolicy.validateSingleInventoryMode(
            contexts.stream().map(ctx -> inventoryMode(ctx.ticketType())).toList());
        // contexts CÓ THỂ ĐÃ CŨ, nên cần có double check, tránh

        // ── Step 3: Redis Lock → Stock Check → Atomic Decrement
        // khá giống ReentrantLock nhưng ReentrantLock thuộc phạm vi 1 server, nhiều node là chết ngay
        List<RLock> acquiredLocks = new ArrayList<>();
        try {
            acquiredLocks = ticketReservationService.acquireGlobalLocks(
                event.getId(),
                contexts.stream().map(ctx -> ctx.ticketType().getId()).toList(),
                contexts.stream().flatMap(ctx -> ctx.seatIds().stream()).toList()
            );

            for (BookingItemContext ctx : contexts) {
                if (inventoryMode(ctx.ticketType()) == InventoryMode.ASSIGNED_SEAT) {
                    seatBookingService.validateSeats(event.getId(), ctx.ticketType().getId(), ctx.seatIds());
                }
            }

            for (BookingItemContext ctx : contexts) {
                // Double-check stock SAU KHI có lock (quan trọng!) để tránh:
                /**
                 * Khi thread A acquire được lock và thực hiện trừ stock, thread B đến sau sẽ thử lấy lock nhưng thất bại vì A đang giữ nó,
                 * sau đó B sẽ chờ trong khoảng waitTime. Khi A hoàn tất thanh toán và nhả lock, Redis publish sự kiện unlock,
                 * lúc này B được đánh thức và retry acquire thành công. Tuy nhiên tại thời điểm B vào critical section thì stock đã bị A trừ về 0,
                 * (trước đó thread B build Context (buildAndValidateContexts) vẫn là 10 nhưng trong khoảng thời gian wait lock thì đã bị lock A trừ về 0))
                 * vì vậy bước double-check sẽ ngăn không cho tiếp tục trừ thêm lần nữa, từ đó tránh tình trạng oversell.
                 * */
                /**
                 * T1: đọc available = 10
                 * T2: request khác mua 10 vé
                 * T3: bạn acquire lock
                 * T4: nếu không double-check → bạn vẫn nghĩ còn 10
                 * */
                // Lock đảm bảo chỉ 1 request chạy đoạn này cùng lúc cho ticket type này
                int available = ticketInventoryCounterService
                    .findAvailableQuantity(ctx.ticketType().getId())
                    .orElse(0);

                if (available < ctx.quantity()) {
                    throw new InsufficientStockException(
                        ctx.ticketType().getName(), available, ctx.quantity());
                }

                /**
                 * Vẫn Có rủi ro sau double-check:
                 * T1: acquire lock
                 * T2: double-check thấy available = 5
                 * T3: trước khi UPDATE, một hệ thống khác update DB trực tiếp
                 * T4: UPDATE ... WHERE available >= qty
                 * */
                /** 3 lớp bảo vệ:
                 * Redis Lock → giảm contention
                 * Double-check → đảm bảo logic đúng
                 * Atomic SQL → bảo vệ tuyệt đối
                 * */

                //  Atomic decrement trong DB — safety net thứ 2 chống stock âm (WHERE available >= qty)
                int updated = ticketInventoryCounterService.reserveQuantity(
                    ctx.ticketType().getId(), ctx.quantity());

                /**
                 * Nếu = 0 → Không có bản ghi nào được update
                 * Nếu = 1 → Update thành công
                 * */
                if (updated == 0) { // optimistic-style stock check
                    // Race condition cực kỳ hiếm — lock chưa kịp protect
                    throw new InsufficientStockException(
                        ctx.ticketType().getName(), 0, ctx.quantity());
                }

                // 3d. Đánh dấu SOLD_OUT nếu hết vé (không critical, chỉ để UI hiển thị)
                ticketInventoryCounterService.markSoldOutIfEmpty(ctx.ticketType().getId());
            }

            // Apply Promotion (nếu có) — RESERVE slot, không record usage
            BigDecimal subtotal = contexts.stream()
                .map(ctx -> ctx.ticketType().getPrice().multiply(BigDecimal.valueOf(ctx.quantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

            PromotionService.DiscountResult discount = PromotionService.DiscountResult.ZERO;
            if (request.promotionCode() != null && !request.promotionCode().isBlank()) {
                // reservePromotion(): atomic increment current_uses để giữ slot, không thỏa mãn voucher -> throw exception -> không create Order
                // Nếu order expire/cancel → releasePromotion() sẽ trả slot về
                // Nếu payment success   → PaymentService gọi confirmPromotion()
                discount = promotionService.reservePromotion(
                    request.promotionCode(), userId, event.getId(), subtotal);
            }

            // Create Order
            Order order = buildOrder(request, userId, event, subtotal, discount);
            order = orderRepository.save(order);

            // Create OrderItems
            List<OrderItem> items = buildOrderItems(order, contexts, event);
            items = orderItemRepository.saveAll(items);

            Map<UUID, OrderItem> itemByTicketType = items.stream()
                .collect(Collectors.toMap(OrderItem::getTicketTypeId, Function.identity()));
            for (BookingItemContext ctx : contexts) {
                if (inventoryMode(ctx.ticketType()) == InventoryMode.ASSIGNED_SEAT) {
                    OrderItem item = itemByTicketType.get(ctx.ticketType().getId());
                    seatBookingService.reserveSeats(
                        event.getId(),
                        ctx.ticketType().getId(),
                        order.getId(),
                        item.getId(),
                        ctx.seatIds(),
                        ctx.ticketType().getPrice()
                    );
                }
            }

            // NOTE: KHÔNG gọi recordUsage/confirmPromotion ở đây.
            // PaymentService.handleIPN() sẽ gọi promotionService.confirmPromotion() sau khi payment success.

            log.info("Booking created: order={}, user={}, event={}, total={}",
                order.getOrderNumber(), userId, event.getTitle(), order.getTotalAmount());

            List<OrderItemDTO> itemDTOs = buildOrderItemDtos(order.getId(), items);
            return BookingResponse.from(order, itemDTOs);

        } finally {
            // ── Luôn release locks dù có exception hay không
            acquiredLocks.forEach(ticketReservationService::releaseLock);
        }
    }

    // ══ READ OPERATIONS ══════════════════════════════════════════════════════

    /**
     * Danh sách orders của user — phân trang.
     */
    @Transactional(readOnly = true)
    public Page<OrderSummaryDTO> getMyOrders(String userId, Pageable pageable) {
        Page<Order> orders = orderRepository
            .findByUserIdAndIsDeletedFalseOrderByCreatedAtDesc(userId, pageable);
        return orders.map(OrderSummaryDTO::from);
    }

    /**
     * Chi tiết 1 order — bao gồm items.
     * IDOR protection: chỉ trả về nếu order thuộc về userId.
     */
    @Transactional(readOnly = true)
    public OrderDetailResponse getOrderDetail(UUID orderId, String userId) {
        Order order = orderRepository.findByIdAndUserIdAndIsDeletedFalse(orderId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Đơn hàng không tồn tại"));

        List<OrderItem> orderItems = orderItemRepository.findByOrderId(orderId);
        List<OrderItemDTO> items = buildOrderItemDtos(orderId, orderItems);

        return OrderDetailResponse.from(order, items);
    }

    // ══ CANCEL ORDER ════════════════════════════════════════════════════════

    /**
     * Cancel order — chỉ được khi status = PENDING.
     * Restore stock và release Redis lock (lock đã release từ lúc booking, không cần lock lại).
     */
    @Transactional
    public void cancelOrder(UUID orderId, String userId) {
        Order order = orderRepository.findByIdAndUserIdAndIsDeletedFalse(orderId, userId)
            .orElseThrow(() -> new ResourceNotFoundException("Đơn hàng không tồn tại"));

        if (order.getStatus() != Order.OrderStatus.PENDING) {
            throw new InvalidRequestException(
                "Chỉ có thể hủy đơn hàng đang chờ thanh toán. Trạng thái hiện tại: "
                + order.getStatus().name());
        }

        int updated = orderRepository.markCancelledIfPending(
            orderId, userId, Instant.now(), "User cancelled");
        if (updated == 0) {
            throw new InvalidRequestException("Đơn hàng không còn ở trạng thái chờ thanh toán");
        }

        restoreStock(orderId);
        seatBookingService.restoreSeatsForOrder(orderId);

        // Release promotion slot nếu order có dùng voucher
        promotionService.releasePromotion(order.getPromotionId());

        log.info("Order {} cancelled by user {}", order.getOrderNumber(), userId);
    }

    // ══ PRIVATE HELPERS ════════════════════════════════════════════════════

    /**
     * Validate Event state — 4 conditions.
     */
    private void validateEvent(Event event, BookingRequest request) {
        // Event phải PUBLISHED
        if (event.getStatus() != Event.EventStatus.PUBLISHED) {
            throw new InvalidRequestException(
                "Sự kiện không còn nhận đặt vé (trạng thái: " + event.getStatus() + ")");
        }

        //  Event chưa kết thúc
        if (Instant.now().isAfter(event.getEndDatetime())) {
            throw new InvalidRequestException("Sự kiện đã kết thúc, không thể đặt vé");
        }

        //  Trong sale window của event (nếu có)
        Instant now = Instant.now();
        if (event.getSaleStartDatetime() != null && now.isBefore(event.getSaleStartDatetime())) {
            throw new InvalidRequestException("Vé chưa đến thời gian mở bán");
        }
        if (event.getSaleEndDatetime() != null && now.isAfter(event.getSaleEndDatetime())) {
            throw new InvalidRequestException("Đã hết thời gian mua vé cho sự kiện này");
        }

        // 4. Tổng quantity <= max_tickets_per_order
        int totalQuantity = request.items().stream()
            .mapToInt(BookingRequest.BookingItemRequest::quantity)
            .sum();
        if (event.getMaxTicketsPerOrder() != null && totalQuantity > event.getMaxTicketsPerOrder()) {
            throw new InvalidRequestException(
                "Mỗi đơn hàng tối đa " + event.getMaxTicketsPerOrder() + " vé. Bạn đang chọn " + totalQuantity);
        }
    }

    /**
     * Load ticket types và validate từng item trong request.
     */
    private List<BookingItemContext> buildAndValidateContexts(BookingRequest request, Event event) {
        List<BookingItemContext> contexts = new ArrayList<>();
        Set<UUID> requestedTicketTypeIds = new HashSet<>();
        Set<UUID> requestedSeatIds = new HashSet<>();

        for (BookingRequest.BookingItemRequest itemReq : request.items()) {
            if (!requestedTicketTypeIds.add(itemReq.ticketTypeId())) {
                throw new InvalidRequestException("Không được gửi trùng ticketTypeId trong cùng một đơn hàng");
            }

            TicketType tt = ticketTypeRepository.findByIdAndIsDeletedFalse(itemReq.ticketTypeId())
                .orElseThrow(() -> new ResourceNotFoundException("Loại vé không tồn tại: " + itemReq.ticketTypeId()));

            if (!tt.getEvent().getId().equals(event.getId())) {
                throw new InvalidRequestException("Loại vé '" + tt.getName() + "' không thuộc sự kiện này");
            }
            if (tt.getStatus() != TicketType.TicketStatus.ACTIVE) {
                throw new InvalidRequestException("Loại vé '" + tt.getName() + "' hiện không có sẵn");
            }
            if (!Boolean.TRUE.equals(tt.getIsVisible())) {
                throw new InvalidRequestException("Loại vé '" + tt.getName() + "' không khả dụng");
            }

            Instant now = Instant.now();
            if (tt.getSaleStartDatetime() != null && now.isBefore(tt.getSaleStartDatetime())) {
                throw new InvalidRequestException("Vé '" + tt.getName() + "' chưa đến thời gian bán");
            }
            if (tt.getSaleEndDatetime() != null && now.isAfter(tt.getSaleEndDatetime())) {
                throw new InvalidRequestException("Vé '" + tt.getName() + "' đã hết thời gian bán");
            }
            if (tt.getMaxPerOrder() != null && itemReq.quantity() > tt.getMaxPerOrder()) {
                throw new InvalidRequestException(
                    "Vé '" + tt.getName() + "' tối đa " + tt.getMaxPerOrder() + " vé mỗi đơn");
            }

            List<UUID> seatIds = itemReq.seatIds() != null ? itemReq.seatIds() : List.of();
            for (UUID seatId : seatIds) {
                if (!requestedSeatIds.add(seatId)) {
                    throw new InvalidRequestException("Không được chọn trùng ghế trong cùng một đơn hàng: " + seatId);
                }
            }

            InventoryMode mode = inventoryMode(tt);
            if (mode == InventoryMode.ASSIGNED_SEAT) {
                if (seatIds.size() != itemReq.quantity()) {
                    throw new InvalidRequestException("Số ghế đã chọn phải bằng số lượng vé");
                }
                if (!Boolean.TRUE.equals(tt.getSeatSelectionEnabled())) {
                    throw new InvalidRequestException("Loại vé chọn ghế chưa bật seatSelectionEnabled");
                }
            } else if (!seatIds.isEmpty()) {
                throw new InvalidRequestException("Vé số lượng không được gửi seatIds");
            }

            if (tt.getQuantityAvailable() < itemReq.quantity()) {
                throw new InsufficientStockException(tt.getName(), tt.getQuantityAvailable(), itemReq.quantity());
            }

            contexts.add(new BookingItemContext(tt, itemReq.quantity(), seatIds));
        }

        return contexts;
    }


    private Order buildOrder(BookingRequest request, String userId, Event event,
                             BigDecimal subtotal, PromotionService.DiscountResult discount) {
        BigDecimal totalAmount = subtotal.subtract(discount.amount()).max(BigDecimal.ZERO);

        return Order.builder()
            .orderNumber(generateOrderNumber())
            .userId(userId)
            .customerName(request.customerName())
            .customerEmail(request.customerEmail())
            .customerPhone(request.customerPhone())
            .eventId(event.getId())
            .eventTitle(event.getTitle())
            .eventStartDatetime(event.getStartDatetime())
            .eventVenueName(event.getVenue() != null ? event.getVenue().getName() : null)
            .subtotal(subtotal)
            .discountAmount(discount.amount())
            .totalAmount(totalAmount)
            .currency("VND")
            .promotionId(discount.promotionId())
            .promotionCode(
                (discount.promotionId() != null) ? request.promotionCode() : null)
            .status(Order.OrderStatus.PENDING)
            .expiresAt(Instant.now().plus(ORDER_EXPIRY_MINUTES, ChronoUnit.MINUTES))
            .customerNote(request.customerNote())
            .isDeleted(false)
            .build();
    }

    private List<OrderItem> buildOrderItems(Order order, List<BookingItemContext> contexts, Event event) {
        return contexts.stream().map(ctx -> {
            TicketType tt = ctx.ticketType();
            BigDecimal subtotal = tt.getPrice().multiply(BigDecimal.valueOf(ctx.quantity()));

            return OrderItem.builder()
                .orderId(order.getId())
                .ticketTypeId(tt.getId())
                .ticketTypeName(tt.getName())
                .sectorId(tt.getEventSectorId())
                // sectorName load riêng nếu cần — simplified cho MVP
                .quantity(ctx.quantity())
                .unitPrice(tt.getPrice())
                .subtotal(subtotal)
                .build();
        }).toList();
    }

    private List<OrderItemDTO> buildOrderItemDtos(UUID orderId, List<OrderItem> items) {
        Map<UUID, List<OrderItemSeatDTO>> seatsByOrderItemId = orderItemSeatRepository.findByOrderId(orderId).stream()
            .collect(Collectors.groupingBy(
                OrderItemSeat::getOrderItemId,
                Collectors.mapping(OrderItemSeatDTO::from, Collectors.toList())
            ));

        return items.stream()
            .map(item -> OrderItemDTO.from(
                item,
                seatsByOrderItemId.getOrDefault(item.getId(), List.of())
            ))
            .toList();
    }

    /**
     * Restore stock về ticket_types khi order expire hoặc cancel.
     * Gọi trong @Transactional.
     */
    void restoreStock(UUID orderId) {
        List<OrderItem> items = orderItemRepository.findByOrderId(orderId);
        items.forEach(item ->
            ticketInventoryCounterService.restoreReserved(item.getTicketTypeId(), item.getQuantity())
        );
    }

    void restoreSeatsForExpiredOrder(UUID orderId) {
        seatBookingService.restoreSeatsForOrder(orderId);
    }

    /**
     * Generate order number — format: TB-YYYYMMDD-{6 digits random}
     * Ví dụ: "TB-20260219-482931"
     *
     * Uniqueness đảm bảo bởi UNIQUE constraint trên DB — nếu trùng → retry.
     * Xác suất trùng: 1/10^6 mỗi ngày = gần như không thể xảy ra.
     */
    private String generateOrderNumber() {
        String datePart = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"))
            .format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        int randomPart = ThreadLocalRandom.current().nextInt(100000, 999999);
        return "TB-" + datePart + "-" + randomPart;
    }

    /** Internal value object — context cho 1 booking item */
    private record BookingItemContext(
            TicketType ticketType,
            int quantity,
            List<UUID> seatIds) {

        BookingItemContext(TicketType ticketType, int quantity) {
            this(ticketType, quantity, List.of());
        }
    }

    private InventoryMode inventoryMode(TicketType ticketType) {
        return ticketType.getInventoryMode() != null
            ? ticketType.getInventoryMode()
            : InventoryMode.QUANTITY;
    }
}
