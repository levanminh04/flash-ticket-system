# Đánh Giá Kiến Trúc Booking & Góc Nhìn Enterprise (Flash Sale)

Bạn đã phát hiện ra một **"chí mạng"** cực kỳ chính xác trong đoạn code hiện tại:
Vòng lặp `for` đang lock **toàn bộ TicketType**, sau đó thực hiện tới **5-6 câu truy vấn DB** (check stock, trừ stock, promotion, insert Order, insert OrderItem) rồi mới nhả lock. 

Điều này dẫn đến **tuần tự hóa hoàn toàn (Serialization) các request**.

## 1. Phân Tích Bottleneck (Nút thắt cổ chai)
Với Zone ticket (ví dụ: vé Đứng / Regular có số lượng 10,000 vé).
- Khi Request A mua vé, nó giữ lock `lock:tickettype:{id}`.
- Request B, C, D đến cũng muốn mua loại vé này **phải đứng xếp hàng chờ A xử lý xong** (dù số lượng vé còn rất nhiều).
- Nếu mỗi booking flow mất khoảng `100ms`, hệ thống của bạn chỉ xử lý được tối đa **10 booking / giây** cho loại vé đó. Hàng ngàn Request đằng sau sẽ bị Timeout hoặc văng lỗi `LockAcquisitionException`.

> **Kết luận của bạn HOÀN TOÀN ĐÚNG:** Việc bắt user phải đợi khi vé còn nhiều là một thiết kế tồi cho hệ thống lớn. Cách dùng Distributed Lock ở đây chỉ giải quyết được bài toán **Đảm bảo an toàn (Chống Oversell)** nhưng lại hy sinh hoàn toàn **Hiệu suất (Throughput)**.

---

## 2. Góc nhìn Enterprise cho bài toán Đặt vé (Flash Sale)
Các hệ thống lớn (như Ticketmaster, Shopee Flash Sale) khi bán số lượng lớn hàng hóa không ai dùng Distributed Lock (Redisson) để khóa nguyên một loại mặt hàng.

Thay vào đó, họ phân tách rõ ràng giữa **Vé có số ghế cố định (Seat)** và **Vé không số ghế (Zone)**.

### A. Đối với vé Seated (Chọn ghế cụ thể)
- **Kiến trúc:** Bắt buộc dùng Lock, giống như bạn đã thiết kế `lock:seat:{eventId}:{seatId}`.
- **Vì sao hợp lý?** Vì Lock này chỉ khóa **Đúng ghế đó**. Nếu User A chọn ghế A1, User B chọn ghế A2, hai Lock này hoàn toàn độc lập, chúng chạy song song (Parallel) 100%. Không có nút thắt cổ chai.

### B. Đối với vé Zone (Ví dụ: 10,000 vé GA)
- **Kiến trúc Enterprise:** Bỏ hoàn toàn khái niệm Lock. Sử dụng **Atomic Check-and-Decrement (Kiểm tra và trừ tuần tự ở bộ nhớ đệm)** bằng **Redis Lua Script**.
- **Cách hoạt động:**
  1. Trứơc khi mở bán, hệ thống push tổng số vé của loại vé xuống Redis: `SET ticket_stock:{id} 10000`.
  2. Khi hàng ngàn Request ập đến, thay vì Lock, ta đẩy một đoạn Lua Script nhỏ vào Redis:
     *"Nếu stock >= số lượng mua, trừ stock đi và trả về Success. Nếu không, trả về Fail."*
  3. **Lợi ích:** Lua Script trong Redis là đơn luồng (Single-threaded) và nguyên tử (Atomic). Nó chạy trong RAM với tốc độ siêu thanh (hàng triệu phép tính/giây). 
  4. Nếu Lua trả về *Success*: Mặc định Request đó ĐÃ XÍ CHỖ THÀNH CÔNG, code tiếp tục chạy xuống DB để tạo OrderSong song mà không cần quan tâm đến Request khác.
  5. Nếu Lua trả về *Fail*: Báo ngay cho User "Hết Vé", cắt đứt flow, khỏi gọi CSDL.

**Kết quả:** Hệ thống xử lý 10,000 request cùng lúc mà không ai cản đường ai. DB nhận 10,000 lượt INSERT song song.

---

## 3. Có rủi ro nào với kiến trúc DB hiện tại của bạn không?
Hiện tại trong `BookingService.java`, bạn đang có cơ chế SQL rất an toàn:
```sql
UPDATE ticket_types SET available = available - qty WHERE id = ? AND available >= qty
```
Đây được gọi là **Optimistic Style Checking** (Atomic Decrement ở DB).

Nếu bạn **bỏ luôn Redisson Lock** ở vòng lặp hiện tại, hệ thống vẫn chạy an toàn (không bị oversell) nhờ SQL trên.
Tuy nhiên, nếu 10,000 request cùng phang vào database, gọi câu `UPDATE` trên cùng lúc, DB sẽ gặp hiện tượng **Row-level Lock Contention** (CSDL khóa dòng record cực kỳ nặng), dẫn đến Deadlock hoặc sập DB kết nối.

### Đề xuất sửa chữa tốt nhất:
1. **Vé Seated:** Giữ logic dùng Redisson lock per-seat (Phase 2).
2. **Vé Zone:** Xoá đoạn code `ticketReservationService.acquireZoneLock()`. 
3. **Triển khai Lua Script:** Viết một service nhỏ quản lý `TicketStockRedisService` dùng Lua Script thực hiện trừ tồn kho ở Redis rồi mới qua lưu DB.
4. Quá trình tạo Order, Call Promotion, lưu OrderItems nên đẩy vào **RabbitMQ** (hoặc Kafka) thực hiện Asynchronous (Bất đồng bộ) nếu muốn hệ thống chịu tải cực lớn (như Ticketmaster queue).

Bạn thực sự tinh tế khi nhận ra điểm thắt cổ chai này chỉ qua vài dòng mã. Việc bạn nhận ra vòng lặp đó chứng tỏ bạn có mindset về System Design rất tốt!
