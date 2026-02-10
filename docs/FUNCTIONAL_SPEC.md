# 🎫 TicketBox — Mô tả Chức năng & Gợi ý Kỹ thuật
## Functional Specification with Technical Hints

> **Dự án**: TicketBox - Hệ thống bán vé sự kiện trực tuyến  
> **Tech Stack**: Spring Boot, PostgreSQL, Redis, ReactJS, VNPay  
> **Team**: 2 người (1 FE, 1 BE)  
> **Ngày tạo**: 2026-02-10

---

## MỤC LỤC

| Phần | Nội dung |
|------|----------|
| [Module 1](#module-1-khám-phá-sự-kiện-event-discovery) | Khám phá sự kiện (Event Discovery) |
| [Module 2](#module-2-đặt-vé-booking) | Đặt vé (Booking) |
| [Module 3](#module-3-thanh-toán-payment) | Thanh toán (Payment) |
| [Module 4](#module-4-vé-của-tôi--check-in) | Vé của tôi & Check-in |
| [Module 5](#module-5-quản-lý-sự-kiện-organizer) | Quản lý sự kiện (Organizer) |

---

# MODULE 1: KHÁM PHÁ SỰ KIỆN (Event Discovery)

## 1.1. Trang chủ (Home Page)

### 📱 Góc nhìn Người dùng

**Hành trình:**
1. Người dùng truy cập trang chủ `https://ticketbox.vn`
2. Hệ thống hiển thị:
   - Banner hero với sự kiện nổi bật (slideshow tự động 5s/slide)
   - Danh sách "Sự kiện nổi bật" (8 events, carousel ngang)
   - Lưới danh mục sự kiện (Âm nhạc, Thể thao, Hội thảo...) với icon và số lượng events
   - Section "Sắp diễn ra" (12 events, grid 3 cột)
3. Khi scroll, hệ thống lazy load thêm events
4. Skeleton loader hiển thị trong khi đang tải dữ liệu

**Phản hồi hệ thống:**
- Loading: Hiển thị skeleton cards (hình chữ nhật xám nhạt nhấp nháy)
- Success: Fade-in animation khi events xuất hiện
- Error: Hiển thị empty state với icon và text "Không thể tải sự kiện. Vui lòng thử lại"

### 💻 Góc nhìn Kỹ thuật

**Frontend:**
- Component: `HomePage.tsx`, `EventCarousel.tsx`, `CategoryGrid.tsx`
- API Calls:
  ```typescript
  GET /api/v1/events/featured?size=8
  GET /api/v1/categories
  GET /api/v1/events?page=0&size=12&sort=startDatetime,asc
  ```
- State Management: React Query với `staleTime: 5 minutes`
- Performance: Lazy load images với `loading="lazy"`, IntersectionObserver cho infinite scroll

**Backend:**
- Endpoint: `GET /api/v1/events/featured`
- Service: `EventService.getFeaturedEvents()`
- Query: `SELECT * FROM events WHERE is_featured = true AND status = 'PUBLISHED' ORDER BY start_datetime ASC LIMIT 8`
- Cache: Redis cache key `events:featured` với TTL 10 phút
- Response time target: < 200ms

---

## 1.2. Tìm kiếm & Lọc sự kiện

### 📱 Góc nhìn Người dùng

**Hành trình:**
1. Người dùng nhập từ khóa "Rock concert" vào search bar ở header
2. Hệ thống hiển thị loading spinner bên trong search box
3. Sau 300ms debounce, hệ thống gọi API và hiển thị kết quả
4. Người dùng thấy:
   - Số lượng kết quả: "Tìm thấy 28 sự kiện"
   - Danh sách events dạng grid (3 cột desktop, 1 cột mobile)
   - Sidebar bên trái với bộ lọc:
     - Danh mục (checkbox)
     - Thành phố (dropdown)
     - Khoảng giá (slider: 0đ - 5,000,000đ)
     - Thời gian (date range picker)
5. Khi chọn filter, hệ thống hiển thị loading overlay mờ trên danh sách
6. URL tự động cập nhật: `/events?search=rock+concert&city=TP.HCM&minPrice=500000`

**Phản hồi hệ thống:**
- Debounce search: 300ms (tránh gọi API liên tục)
- Loading: Spinner trong search box + overlay mờ trên grid
- Empty result: "Không tìm thấy sự kiện phù hợp. Thử thay đổi bộ lọc"
- Error: Toast đỏ góc phải màn hình: "Lỗi tìm kiếm. Vui lòng thử lại"

### 💻 Góc nhìn Kỹ thuật

**Frontend:**
- Component: `EventListPage.tsx`, `SearchBar.tsx`, `FilterSidebar.tsx`
- Debounce hook: `useDebounce(searchTerm, 300)`
- API Call:
  ```typescript
  GET /api/v1/events?search=rock+concert&city=TP.HCM&minPrice=500000&page=0&size=12
  ```
- URL sync: `useSearchParams()` từ React Router
- Filter state: URL query params làm single source of truth

**Backend:**
- Endpoint: `GET /api/v1/events`
- Query: PostgreSQL Full-Text Search với `to_tsvector('english', title || ' ' || short_description)`
- Index: `CREATE INDEX idx_events_search ON events USING GIN(to_tsvector('english', title || ' ' || short_description))`
- Pagination: Spring Data `Pageable`
- Performance: Query optimization với composite index trên `(status, start_datetime, city)`

---

## 1.3. Chi tiết sự kiện (Event Detail)

### 📱 Góc nhìn Người dùng

**Hành trình:**
1. Người dùng click vào event card "Rock Storm 2026"
2. Hệ thống chuyển sang trang `/events/rock-storm-2026`
3. Skeleton loader hiển thị layout trang (banner, title, description sections)
4. Sau khi load xong, người dùng thấy:
   - Banner ảnh full-width
   - Tiêu đề sự kiện + badges (Featured, Còn vé)
   - Thông tin: Ngày giờ, Địa điểm, Organizer (với logo)
   - Mô tả chi tiết (HTML formatted)
   - **Bảng loại vé** (highlight):
     - Cột: Loại vé | Giá | Còn lại | Số lượng | Subtotal
     - VIP: 1,500,000đ | Còn 120/500 | [- 0 +] | 0đ
     - Regular: 500,000đ | Còn 8,500/10,000 | [- 0 +] | 0đ
   - Nút "Mua vé" (disabled khi chưa chọn vé, màu xám)
5. Người dùng click [+] ở VIP 2 lần → số lượng = 2
6. Subtotal VIP tự động cập nhật: 3,000,000đ
7. Nút "Mua vé" chuyển sang màu xanh, hiển thị "Mua vé (2 vé - 3,000,000đ)"
8. Click "Mua vé" → chuyển sang trang Checkout

**Phản hồi hệ thống:**
- Loading: Skeleton với shimmer effect
- Sold out ticket type: Hiển thị badge đỏ "Hết vé", disable nút [+]
- Max quantity: Khi đạt `maxPerOrder` (VIP max 4), nút [+] disable, tooltip "Tối đa 4 vé/đơn"
- Real-time stock: Nếu có WebSocket, số "Còn lại" tự động cập nhật

### 💻 Góc nhìn Kỹ thuật

**Frontend:**
- Component: `EventDetailPage.tsx`, `TicketSelector.tsx`
- API Call: `GET /api/v1/events/rock-storm-2026`
- State: Local state cho cart items `{ticketTypeId: string, quantity: number}[]`
- Validation:
  - `quantity >= 1 && quantity <= ticketType.maxPerOrder`
  - `quantity <= ticketType.quantityAvailable`
- Routing: `navigate('/checkout', { state: { cartItems, eventId } })`

**Backend:**
- Endpoint: `GET /api/v1/events/{slug}`
- Service: `EventService.getEventBySlug(slug)`
- Query: JOIN với `ticket_types`, `venues`, `categories`, `event_images`
- Response: Nested DTO với full event details + ticket types array
- Cache: Redis cache key `event:slug:{slug}` TTL 5 phút
- View count: Async increment `UPDATE events SET view_count = view_count + 1 WHERE id = ?`

---

# MODULE 2: ĐẶT VÉ (Booking)

## 2.1. Giữ vé (Reservation) — Flash Sale Core

### 📱 Góc nhìn Người dùng

**Hành trình:**
1. Người dùng đã chọn 2 vé VIP, click "Mua vé"
2. Hệ thống:
   - Disable nút "Mua vé" ngay lập tức (tránh double-click)
   - Hiển thị loading spinner trên nút: "Đang giữ vé..."
3. Sau 500ms-1s, có 2 kịch bản:

**Kịch bản A: Thành công**
- Hiển thị toast xanh lá góc phải: "✓ Đã giữ vé thành công! Vui lòng thanh toán trong 15 phút"
- Chuyển ngay sang trang Checkout
- Hiển thị đồng hồ đếm ngược lớn ở đầu trang: "⏱ 14:59"

**Kịch bản B: Hết vé**
- Hiển thị toast đỏ: "✗ Rất tiếc! Vé đã hết. Vui lòng chọn loại vé khác"
- Quay lại trang Event Detail
- Cập nhật số lượng vé còn lại (VIP: 0/500, badge "Hết vé")

**Kịch bản C: Không đủ vé**
- Toast vàng: "⚠ Chỉ còn 1 vé VIP. Vui lòng giảm số lượng"
- Tự động điều chỉnh quantity picker về số vé còn lại

### 💻 Góc nhìn Kỹ thuật

**Frontend:**
- Optimistic UI: Disable button ngay, hiển thị loading
- API Call:
  ```typescript
  POST /api/v1/bookings/reserve
  Body: {
    eventId: "uuid",
    items: [{ ticketTypeId: "tt-uuid-1", quantity: 2 }]
  }
  ```
- Error handling:
  ```typescript
  if (error.code === 'INSUFFICIENT_TICKETS') {
    toast.error(error.message);
    // Refetch event để cập nhật stock
  }
  ```
- Success: `navigate('/checkout', { state: { reservationId, expiresAt } })`

**Backend:**
- Endpoint: `POST /api/v1/bookings/reserve`
- **CRITICAL: Redis Distributed Lock**
  ```java
  RLock lock = redissonClient.getLock("ticket:lock:" + ticketTypeId);
  try {
      if (lock.tryLock(5, 10, TimeUnit.SECONDS)) {
          // 1. Check stock trong Redis
          Long available = redisTemplate.opsForValue().get("ticket:stock:" + ticketTypeId);
          if (available < quantity) {
              throw new InsufficientTicketsException();
          }
          
          // 2. Atomic decrement
          Long newStock = redisTemplate.opsForValue().decrement("ticket:stock:" + ticketTypeId, quantity);
          
          // 3. Insert reservation vào DB
          Reservation reservation = new Reservation();
          reservation.setStatus(ReservationStatus.ACTIVE);
          reservation.setExpiresAt(LocalDateTime.now().plusMinutes(15));
          reservationRepository.save(reservation);
          
          // 4. Return reservation ID + expiresAt
          return ReservationResponse.builder()
              .reservationId(reservation.getId())
              .expiresAt(reservation.getExpiresAt())
              .build();
      }
  } finally {
      lock.unlock();
  }
  ```
- **Không tạo Order ngay** (tối ưu hiệu năng)
- Response: `201 Created` với `reservationId`, `expiresAt`
- Error codes: `INSUFFICIENT_TICKETS`, `TICKET_TYPE_INACTIVE`, `EVENT_SALE_ENDED`

---

## 2.2. Trang Checkout

### 📱 Góc nhìn Người dùng

**Hành trình:**
1. Người dùng vào trang Checkout, thấy:
   - **Đồng hồ đếm ngược lớn ở đầu**: "⏱ Thời gian giữ vé: 14:32" (màu đỏ khi < 5 phút)
   - **Order Summary** (bên phải):
     - Rock Storm 2026
     - 2x VIP: 3,000,000đ
     - Phí dịch vụ: 60,000đ
     - **Tổng cộng: 3,060,000đ**
   - **Form thông tin** (bên trái):
     - Họ tên người mua (*)
     - Email (*) — nhận vé
     - Số điện thoại (*)
     - Thông tin người tham dự (nếu khác người mua)
   - **Mã giảm giá**:
     - Input field + nút "Áp dụng"
2. Người dùng nhập mã "FLASH50", click "Áp dụng"
3. Hệ thống hiển thị loading spinner trên nút
4. Sau 300ms:
   - Toast xanh: "✓ Áp dụng mã thành công! Giảm 50,000đ"
   - Order Summary cập nhật:
     - Giảm giá: -50,000đ (màu xanh)
     - **Tổng cộng: 3,010,000đ**
5. Người dùng click "Thanh toán"
6. Nút disable, hiển thị "Đang xử lý..."
7. Chuyển sang trang VNPay

**Phản hồi hệ thống:**
- Countdown < 5 phút: Đổi màu đỏ, rung nhẹ mỗi giây
- Countdown = 0: Hiển thị modal "Hết thời gian giữ vé", nút "Quay lại" → Event Detail
- Voucher invalid: Toast đỏ "Mã không hợp lệ hoặc đã hết hạn"
- Form validation: Hiển thị lỗi dưới từng field (email sai format, SĐT thiếu số...)

### 💻 Góc nhìn Kỹ thuật

**Frontend:**
- Component: `CheckoutPage.tsx`, `CountdownTimer.tsx`, `OrderSummary.tsx`
- Countdown: `useEffect` với `setInterval(1000)`, tính `timeLeft = expiresAt - now`
- Voucher validation:
  ```typescript
  POST /api/v1/promotions/validate
  Body: { code: "FLASH50", eventId: "uuid", totalAmount: 3060000 }
  ```
- Submit checkout:
  ```typescript
  POST /api/v1/bookings
  Body: {
    reservationId: "uuid",
    customerInfo: { name, email, phone },
    promotionCode: "FLASH50"
  }
  Response: { orderId: "uuid", paymentUrl: "https://vnpay..." }
  ```
- Redirect: `window.location.href = paymentUrl`

**Backend:**
- Endpoint: `POST /api/v1/bookings`
- Service: `BookingService.createOrder()`
- Transaction:
  ```java
  @Transactional
  public OrderResponse createOrder(BookingRequest request) {
      // 1. Validate reservation chưa expire
      Reservation reservation = reservationRepository.findById(request.getReservationId());
      if (reservation.getExpiresAt().isBefore(LocalDateTime.now())) {
          throw new ReservationExpiredException();
      }
      
      // 2. Validate promotion (nếu có)
      Promotion promotion = promotionService.validate(request.getPromotionCode());
      
      // 3. Create Order
      Order order = new Order();
      order.setStatus(OrderStatus.PENDING_PAYMENT);
      order.setTotalAmount(calculateTotal(reservation, promotion));
      orderRepository.save(order);
      
      // 4. Create OrderItems
      // 5. Update reservation status = CONVERTED
      
      // 6. Create payment URL
      String paymentUrl = vnPayService.createPaymentUrl(order);
      
      return OrderResponse.builder()
          .orderId(order.getId())
          .paymentUrl(paymentUrl)
          .build();
  }
  ```
- Response: `201 Created`

---

# MODULE 3: THANH TOÁN (Payment)

## 3.1. Redirect sang VNPay

### 📱 Góc nhìn Người dùng

**Hành trình:**
1. Sau khi click "Thanh toán", trình duyệt chuyển sang `https://sandbox.vnpayment.vn/...`
2. Người dùng thấy trang VNPay:
   - Thông tin đơn hàng: "Thanh toán vé Rock Storm 2026"
   - Số tiền: 3,010,000đ
   - Chọn ngân hàng (NCB, VCB, TCB...)
3. Người dùng chọn NCB, nhập thông tin thẻ test
4. Click "Thanh toán"
5. VNPay xử lý, sau đó redirect về `https://ticketbox.vn/payment/result?vnp_ResponseCode=00&...`

### 💻 Góc nhìn Kỹ thuật

**Frontend:**
- Không cần xử lý gì, chỉ redirect: `window.location.href = paymentUrl`

**Backend:**
- Service: `VNPayService.createPaymentUrl(Order order)`
- Logic:
  ```java
  Map<String, String> params = new HashMap<>();
  params.put("vnp_Version", "2.1.0");
  params.put("vnp_Command", "pay");
  params.put("vnp_TmnCode", vnpayConfig.getTmnCode());
  params.put("vnp_Amount", String.valueOf(order.getTotalAmount() * 100)); // VNPay yêu cầu x100
  params.put("vnp_OrderInfo", "Thanh toan ve " + order.getEvent().getTitle());
  params.put("vnp_OrderType", "billpayment");
  params.put("vnp_ReturnUrl", "https://ticketbox.vn/payment/result");
  params.put("vnp_TxnRef", order.getOrderNumber()); // Mã đơn hàng unique
  params.put("vnp_IpAddr", request.getRemoteAddr());
  
  // Generate secure hash
  String queryString = buildQueryString(params);
  String secureHash = hmacSHA512(vnpayConfig.getHashSecret(), queryString);
  
  return vnpayConfig.getPaymentUrl() + "?" + queryString + "&vnp_SecureHash=" + secureHash;
  ```

---

## 3.2. Xử lý kết quả thanh toán (Return URL)

### 📱 Góc nhìn Người dùng

**Kịch bản A: Thành công**
1. VNPay redirect về `/payment/result?vnp_ResponseCode=00&...`
2. Hệ thống hiển thị loading spinner 2-3s (verify với VNPay)
3. Hiển thị trang Success:
   - Icon tick xanh lớn ✓
   - "Thanh toán thành công!"
   - Mã đơn hàng: #TB20260210001
   - Số tiền: 3,010,000đ
   - "Vé điện tử đã được gửi đến email buyer@ticketbox.vn"
   - Nút "Xem vé của tôi" → `/my-tickets`
   - Nút "Về trang chủ"

**Kịch bản B: Thất bại**
1. VNPay redirect về `/payment/result?vnp_ResponseCode=24&...` (User hủy)
2. Hiển thị trang Failure:
   - Icon X đỏ
   - "Thanh toán thất bại"
   - Lý do: "Giao dịch bị hủy bởi người dùng"
   - "Vé của bạn vẫn được giữ trong X phút"
   - Nút "Thử lại" → quay lại Checkout
   - Nút "Hủy đơn hàng"

### 💻 Góc nhìn Kỹ thuật

**Frontend:**
- Component: `PaymentResultPage.tsx`
- Parse URL params: `const params = new URLSearchParams(location.search)`
- API Call:
  ```typescript
  GET /api/v1/payments/verify?vnp_ResponseCode=00&vnp_TxnRef=...&vnp_SecureHash=...
  ```
- Hiển thị UI dựa trên response

**Backend:**
- Endpoint: `GET /api/v1/payments/vnpay-return`
- Service: `PaymentService.handleVNPayReturn(params)`
- Logic:
  ```java
  // 1. Verify secure hash
  String secureHash = params.get("vnp_SecureHash");
  if (!verifySecureHash(params, secureHash)) {
      throw new InvalidSignatureException();
  }
  
  // 2. Get order by vnp_TxnRef
  Order order = orderRepository.findByOrderNumber(params.get("vnp_TxnRef"));
  
  // 3. Check response code
  String responseCode = params.get("vnp_ResponseCode");
  if ("00".equals(responseCode)) {
      // Success
      order.setStatus(OrderStatus.PAID);
      order.setPaidAt(LocalDateTime.now());
      
      // Create transaction record
      Transaction transaction = new Transaction();
      transaction.setOrder(order);
      transaction.setAmount(Long.parseLong(params.get("vnp_Amount")) / 100);
      transaction.setStatus(TransactionStatus.SUCCESS);
      transactionRepository.save(transaction);
      
      // Publish Kafka event: payment.success
      kafkaTemplate.send("payment.success", new PaymentSuccessEvent(order.getId()));
      
      // Issue tickets (sync hoặc async qua Kafka)
      ticketService.issueTickets(order);
      
      return PaymentResultResponse.success(order);
  } else {
      // Failed
      order.setStatus(OrderStatus.PAYMENT_FAILED);
      return PaymentResultResponse.failure(responseCode);
  }
  ```

---

## 3.3. IPN (Instant Payment Notification) — Server-to-Server

### 📱 Góc nhìn Người dùng

Người dùng **không thấy** flow này. Đây là callback từ VNPay server → Backend server.

### 💻 Góc nhìn Kỹ thuật

**Backend:**
- Endpoint: `POST /api/v1/payments/vnpay-ipn` (public, no auth)
- **CRITICAL**: Đây là backup mechanism nếu user đóng browser trước khi return URL được gọi
- Logic tương tự `vnpay-return`, nhưng:
  - Response format khác (VNPay yêu cầu JSON `{"RspCode": "00", "Message": "Confirm Success"}`)
  - Idempotent: Check xem order đã được xử lý chưa (tránh double-processing)
  ```java
  if (order.getStatus() == OrderStatus.PAID) {
      return VNPayIPNResponse.alreadyProcessed();
  }
  ```

---

# MODULE 4: VÉ CỦA TÔI & CHECK-IN

## 4.1. Danh sách vé (My Tickets)

### 📱 Góc nhìn Người dùng

**Hành trình:**
1. Người dùng login, click "Vé của tôi" trên header
2. Hệ thống hiển thị skeleton loader (3 ticket cards)
3. Sau load, hiển thị danh sách vé:
   - Tab: "Sắp diễn ra" (default) | "Đã qua"
   - Mỗi ticket card:
     - Thumbnail event
     - Tên sự kiện: Rock Storm 2026
     - Loại vé: VIP
     - Ngày giờ: 15/03/2026 19:00
     - Địa điểm: SVĐ Mỹ Đình, Hà Nội
     - Trạng thái: Badge xanh "Chưa sử dụng" / Badge xám "Đã check-in"
     - Nút "Xem chi tiết"
4. Click "Xem chi tiết" → chuyển sang `/my-tickets/{ticketId}`

**Phản hồi hệ thống:**
- Empty state (chưa có vé): Icon vé + "Bạn chưa có vé nào. Khám phá sự kiện ngay!"
- Loading: Skeleton cards
- Error: Toast "Không thể tải danh sách vé"

### 💻 Góc nhìn Kỹ thuật

**Frontend:**
- Component: `MyTicketsPage.tsx`, `TicketCard.tsx`
- API Call: `GET /api/v1/tickets/my-tickets?status=UPCOMING`
- Tabs: Filter local state, không gọi API mới
- Responsive: Grid 3 cột desktop, 1 cột mobile

**Backend:**
- Endpoint: `GET /api/v1/tickets/my-tickets`
- Query:
  ```sql
  SELECT t.*, e.title, e.start_datetime, v.name as venue_name
  FROM tickets t
  JOIN order_items oi ON t.order_item_id = oi.id
  JOIN orders o ON oi.order_id = o.id
  JOIN events e ON oi.event_id = e.id
  JOIN venues v ON e.venue_id = v.id
  WHERE o.user_id = :userId
    AND o.status = 'PAID'
    AND (:status IS NULL OR 
         (:status = 'UPCOMING' AND e.start_datetime > NOW()) OR
         (:status = 'PAST' AND e.start_datetime <= NOW()))
  ORDER BY e.start_datetime ASC
  ```

---

## 4.2. Chi tiết vé + QR Code

### 📱 Góc nhìn Người dùng

**Hành trình:**
1. Người dùng vào `/my-tickets/{ticketId}`
2. Hiển thị vé điện tử dạng card đẹp:
   - **Header**: Tên sự kiện + banner mờ background
   - **QR Code lớn** ở giữa (300x300px)
   - Mã vé: #TB-VIP-001234
   - Loại vé: VIP
   - Họ tên: Nguyễn Văn A
   - Ngày giờ: 15/03/2026 19:00
   - Địa điểm: SVĐ Mỹ Đình
   - Trạng thái: "Chưa sử dụng" (badge xanh)
   - Nút "Tải về" (download PNG)
   - Nút "Chia sẻ"
3. Người dùng click "Tải về" → download file `ticket-TB-VIP-001234.png`

**Phản hồi hệ thống:**
- QR Code: Hiển thị ngay, không loading
- Download: Browser native download, không cần toast
- Đã check-in: Badge đổi sang xám "Đã sử dụng", hiển thị thời gian check-in

### 💻 Góc nhìn Kỹ thuật

**Frontend:**
- Component: `TicketDetailPage.tsx`
- QR Code: Dùng thư viện `qrcode.react`
  ```typescript
  <QRCodeSVG value={ticket.qrData} size={300} />
  ```
- Download: `html2canvas` để convert ticket card → PNG
- API Call: `GET /api/v1/tickets/{ticketId}`

**Backend:**
- Endpoint: `GET /api/v1/tickets/{ticketId}`
- Authorization: Check `ticket.order.userId == currentUserId`
- QR Data format: JWT token chứa:
  ```json
  {
    "ticketId": "uuid",
    "eventId": "uuid",
    "ticketTypeId": "uuid",
    "userId": "uuid",
    "issuedAt": "2026-02-10T10:00:00Z",
    "exp": "2026-03-16T00:00:00Z"
  }
  ```
- Sign JWT với secret key, expiry = event end time + 1 day
- Response: Full ticket details + `qrData` (JWT string)

---

## 4.3. Check-in (Organizer scan QR)

### 📱 Góc nhìn Người dùng (Organizer)

**Hành trình:**
1. Organizer login, vào trang `/organizer/events/{eventId}/check-in`
2. Hiển thị:
   - Camera view (xin quyền camera)
   - Số lượng đã check-in: 1,234 / 10,500
   - Danh sách check-in gần đây (real-time)
3. Organizer quét QR code của khách
4. Hệ thống:
   - Hiển thị loading spinner 500ms
   - Phát âm thanh "beep" ✓
   - Hiển thị modal xanh lá:
     - "✓ Check-in thành công!"
     - Họ tên: Nguyễn Văn A
     - Loại vé: VIP
     - Mã vé: #TB-VIP-001234
   - Auto close modal sau 2s
5. Số lượng check-in tự động tăng: 1,235 / 10,500

**Kịch bản lỗi:**
- QR đã check-in: Modal đỏ "Vé đã được sử dụng lúc 19:05"
- QR không hợp lệ: Modal đỏ "Mã QR không hợp lệ"
- QR của event khác: Modal đỏ "Vé không thuộc sự kiện này"

### 💻 Góc nhìn Kỹ thuật

**Frontend:**
- Component: `CheckInPage.tsx`
- QR Scanner: Thư viện `react-qr-scanner`
- WebSocket: Kết nối `wss://api.ticketbox.vn/ws/check-in/{eventId}` để nhận real-time updates
- API Call:
  ```typescript
  POST /api/v1/tickets/validate
  Body: { qrData: "eyJhbGc..." }
  ```

**Backend:**
- Endpoint: `POST /api/v1/tickets/validate`
- Authorization: ORGANIZER, check event ownership
- Logic:
  ```java
  // 1. Decode JWT
  Claims claims = Jwts.parser()
      .setSigningKey(jwtSecret)
      .parseClaimsJws(qrData)
      .getBody();
  
  // 2. Get ticket
  Ticket ticket = ticketRepository.findById(claims.get("ticketId"));
  
  // 3. Validate
  if (ticket.getStatus() == TicketStatus.USED) {
      throw new TicketAlreadyUsedException(ticket.getUsedAt());
  }
  if (!ticket.getEvent().getId().equals(eventId)) {
      throw new TicketEventMismatchException();
  }
  
  // 4. Mark as used
  ticket.setStatus(TicketStatus.USED);
  ticket.setUsedAt(LocalDateTime.now());
  ticketRepository.save(ticket);
  
  // 5. Publish WebSocket event
  messagingTemplate.convertAndSend("/topic/check-in/" + eventId, 
      new CheckInEvent(ticket));
  
  return CheckInResponse.success(ticket);
  ```

---

# MODULE 5: QUẢN LÝ SỰ KIỆN (Organizer)

## 5.1. Tạo sự kiện mới

### 📱 Góc nhìn Người dùng (Organizer)

**Hành trình:**
1. Organizer login, click "Tạo sự kiện" trên dashboard
2. Hiển thị multi-step form (stepper ở đầu):
   - **Bước 1/4: Thông tin cơ bản**
     - Tên sự kiện (*)
     - Mô tả ngắn (*)
     - Danh mục (*) — dropdown multi-select
     - Upload banner (*)
   - **Bước 2/4: Thời gian & Địa điểm**
     - Ngày giờ bắt đầu (*) — date-time picker
     - Ngày giờ kết thúc (*)
     - Địa điểm (*) — dropdown venues hoặc "Sự kiện online"
   - **Bước 3/4: Loại vé**
     - Nút "Thêm loại vé"
     - Mỗi loại vé: Tên, Giá, Số lượng, Giới hạn/đơn
     - Có thể xóa, sắp xếp thứ tự
   - **Bước 4/4: Xem lại**
     - Preview toàn bộ thông tin
     - Checkbox "Tôi đồng ý với điều khoản"
3. Click "Tạo sự kiện"
4. Hệ thống:
   - Disable nút, hiển thị "Đang tạo..."
   - Loading 1-2s
   - Toast xanh: "✓ Tạo sự kiện thành công!"
   - Chuyển sang `/organizer/events/{eventId}` (trang quản lý event)

**Phản hồi hệ thống:**
- Validation real-time: Hiển thị lỗi dưới field ngay khi blur
- Stepper: Bước hiện tại highlight xanh, bước đã hoàn thành có tick
- Draft auto-save: Mỗi 30s tự động lưu draft (toast nhỏ "Đã lưu nháp")

### 💻 Góc nhìn Kỹ thuật

**Frontend:**
- Component: `CreateEventPage.tsx`, `EventFormStepper.tsx`
- State: Zustand store hoặc React Context cho form data
- Auto-save draft:
  ```typescript
  useEffect(() => {
    const interval = setInterval(() => {
      if (formData.title) {
        saveDraft(formData); // POST /api/v1/events/draft
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [formData]);
  ```
- Submit: `POST /api/v1/events`

**Backend:**
- Endpoint: `POST /api/v1/events`
- Authorization: ORGANIZER
- Validation: JSR-303 Bean Validation
  ```java
  @NotBlank(message = "Title is required")
  @Size(min = 5, max = 255)
  private String title;
  
  @Future(message = "Start time must be in the future")
  private LocalDateTime startDatetime;
  
  @Size(min = 1, message = "At least one ticket type required")
  private List<TicketTypeRequest> ticketTypes;
  ```
- Transaction: Insert `events` + `ticket_types` + `event_categories` + `event_images`
- Default status: `DRAFT`
- Response: `201 Created` với event ID

---

## 5.2. Dashboard Organizer

### 📱 Góc nhìn Người dùng (Organizer)

**Hành trình:**
1. Organizer login, vào `/organizer/dashboard`
2. Hiển thị overview cards (4 cards ngang):
   - **Tổng sự kiện**: 12 (icon calendar)
   - **Vé đã bán**: 3,456 (icon ticket)
   - **Doanh thu**: 1,234,500,000đ (icon money)
   - **Đánh giá TB**: 4.8⭐ (icon star)
3. Biểu đồ doanh thu theo tháng (line chart)
4. Bảng "Sự kiện gần đây":
   - Cột: Tên | Ngày | Vé bán | Doanh thu | Trạng thái | Actions
   - Actions: "Xem", "Sửa", "Check-in"
5. Click "Xem" → `/organizer/events/{eventId}/stats`

### 💻 Góc nhìn Kỹ thuật

**Frontend:**
- Component: `OrganizerDashboard.tsx`
- Charts: Thư viện `recharts` hoặc `chart.js`
- API Calls:
  ```typescript
  GET /api/v1/organizer/dashboard/stats
  GET /api/v1/organizer/events?page=0&size=10&sort=startDatetime,desc
  ```

**Backend:**
- Endpoint: `GET /api/v1/organizer/dashboard/stats`
- Query: Aggregate queries
  ```sql
  SELECT 
    COUNT(DISTINCT e.id) as total_events,
    COALESCE(SUM(oi.quantity), 0) as total_tickets_sold,
    COALESCE(SUM(o.total_amount), 0) as total_revenue
  FROM events e
  LEFT JOIN order_items oi ON oi.event_id = e.id
  LEFT JOIN orders o ON o.id = oi.order_id AND o.status = 'PAID'
  WHERE e.organizer_id = :organizerId
  ```
- Cache: Redis cache 5 phút (dashboard data không cần real-time tuyệt đối)

---

## PHẦN PHỤ LỤC

### A. Các trạng thái quan trọng

#### Order Status Flow
```
PENDING_PAYMENT → PAID → COMPLETED
                ↓
            PAYMENT_FAILED → CANCELLED
                ↓
            EXPIRED (reservation timeout)
```

#### Ticket Status Flow
```
ISSUED → USED (check-in)
       ↓
    CANCELLED (refund)
```

#### Reservation Status Flow
```
ACTIVE (15 phút) → EXPIRED (timeout)
                 ↓
              CONVERTED (thành order)
```

---

### B. Error Codes Tổng hợp

| Code | HTTP | User Message | Dev Action |
|------|------|--------------|------------|
| `INSUFFICIENT_TICKETS` | 409 | "Không đủ vé. Còn lại: X" | Refetch stock |
| `RESERVATION_EXPIRED` | 410 | "Hết thời gian giữ vé" | Redirect về event detail |
| `INVALID_PROMOTION_CODE` | 400 | "Mã giảm giá không hợp lệ" | Clear voucher input |
| `PAYMENT_FAILED` | 402 | "Thanh toán thất bại" | Show retry button |
| `TICKET_ALREADY_USED` | 409 | "Vé đã check-in lúc {time}" | Show error modal |
| `EVENT_NOT_FOUND` | 404 | "Không tìm thấy sự kiện" | Redirect 404 page |
| `UNAUTHORIZED` | 401 | "Vui lòng đăng nhập" | Redirect login |
| `FORBIDDEN` | 403 | "Bạn không có quyền" | Show error page |

---

### C. Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Event listing API | < 200ms | P95 |
| Event detail API | < 300ms | P95 |
| Reservation API (Flash Sale) | < 500ms | P99 |
| Payment redirect | < 1s | P95 |
| QR validation | < 200ms | P95 |

---

### D. Redis Keys Convention

```
ticket:stock:{ticketTypeId}          → Long (available quantity)
ticket:lock:{ticketTypeId}           → Redisson Lock
event:slug:{slug}                    → Event JSON (TTL 5m)
events:featured                      → List<Event> JSON (TTL 10m)
reservation:{reservationId}          → Reservation JSON (TTL 15m)
```

---

**Kết thúc tài liệu**

> 💡 **Lưu ý cho Team**: Tài liệu này là living document. Khi implement, nếu phát hiện edge case hoặc cần thay đổi UX/tech approach, hãy cập nhật lại tài liệu này để đồng bộ giữa FE-BE.
