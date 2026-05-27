# Flash Ticket System - Hệ thống đặt vé sự kiện phân tán

Chào mừng bạn đến với **Flash Ticket System**. Dự án được phát triển theo kiến trúc Microservices sử dụng hệ sinh thái Spring Boot & Spring Cloud kết hợp với ứng dụng khách hàng React (Vite, TS). Hệ thống cũng tích hợp công cụ vẽ sơ đồ ghế ngồi động (Canvas-based Seat Map), thanh toán trực tuyến qua cổng VNPay, và chức năng tìm kiếm/tư vấn vé thông minh bằng AI Agent (LangChain4j + Gemini API + PGVector).

---

## 📋 Yêu cầu hệ thống (Prerequisites)

- **Hệ điều hành**: Khuyên dùng **Windows 10/11** có cài đặt **Windows Terminal** (để sử dụng script khởi động tự động). Với macOS/Linux, bạn sẽ khởi chạy thủ công bằng command line.
- **Java JDK**: Cần phiên bản **JDK 21** hoặc **JDK 24** (được cấu hình trong `pom.xml`).
- **Apache Maven**: Phiên bản **3.8** trở lên.
- **Node.js**: Phiên bản **18.x** trở lên & **npm**.
- **Docker & Docker Compose**: Để chạy các thành phần trung gian (Redis, RabbitMQ, Kafka).

---

## 🚀 Hướng dẫn khởi chạy nhanh dự án (Quick Start)

> [!IMPORTANT]
> **Hệ thống đã được cấu hình sẵn môi trường Demo từ xa (Remote Databases):**
> File `.env` tại thư mục gốc chứa các thông tin kết nối tới PostgreSQL, MongoDB, và Keycloak được deploy sẵn trên máy chủ Cloud Demo (`15.134.248.39`).
> Do đó, người mới **không cần cài đặt PostgreSQL, MongoDB hoặc cấu hình Keycloak cục bộ** trên máy tính cá nhân để chạy demo. Bạn chỉ cần chạy các service trung gian cục bộ (Redis, RabbitMQ, Kafka).

### Bước 1: Build Keycloak SPI Plugin
Keycloak cần plugin SPI này để đẩy sự kiện người dùng sang RabbitMQ khi có đăng ký mới. Hãy build file `.jar` trước:
```powershell
cd keycloak-rabbitmq-spi
mvn clean package
cd ..
```
*Lưu ý: Lệnh này sẽ tạo ra file `keycloak-rabbitmq-spi.jar` trong thư mục `keycloak-rabbitmq-spi/target/`.*

### Bước 2: Khởi động cơ sở hạ tầng trung gian (Docker Compose)
Chạy lệnh sau tại thư mục gốc để khởi động các container trung gian (Redis, RabbitMQ, Zookeeper, Kafka):
```powershell
docker-compose up -d
```
*(Các container PostgreSQL, MongoDB, Keycloak cũng sẽ chạy local làm môi trường dự phòng khi bạn muốn chuyển hoàn toàn về phát triển Offline).*

### Bước 3: Khởi chạy Backend Services

#### 👉 Cách 1: Chạy tự động (Khuyên dùng cho Windows)
Nếu bạn dùng Windows và đã cài đặt **Windows Terminal** (`wt`), bạn chỉ cần chạy script PowerShell duy nhất từ thư mục gốc:
1. Mở PowerShell.
2. Chạy lệnh:
   ```powershell
   ./run-all-services.ps1
   ```
Script sẽ tự động mở một cửa sổ Windows Terminal mới với **6 tabs** tương ứng cho 6 services và khởi động chúng tuần tự theo đúng thời gian trễ cần thiết.

#### 👉 Cách 2: Chạy thủ công từng Service (macOS / Linux hoặc không dùng Windows Terminal)
Mở các tab terminal riêng biệt và chạy các lệnh sau theo đúng thứ tự dưới đây:

1. **Config Server** (phải chạy đầu tiên):
   ```bash
   cd configserver
   mvn spring-boot:run
   ```
   *(Đợi khoảng 10-15 giây cho đến khi khởi động hoàn tất)*

2. **Eureka Server**:
   ```bash
   cd eureka
   mvn spring-boot:run
   ```
   *(Đợi khoảng 15 giây)*

3. **API Gateway**:
   ```bash
   cd apigateway
   mvn spring-boot:run
   ```
   *(Đợi khoảng 15 giây)*

4. **Core Service**:
   ```bash
   cd core-service
   mvn spring-boot:run
   ```

5. **User Service**:
   ```bash
   cd user-service
   mvn spring-boot:run
   ```

6. **Discovery Service** (AI Agent):
   ```bash
   cd discovery-service
   mvn spring-boot:run
   ```

### Bước 4: Khởi chạy Frontend
Mở một terminal mới, chuyển đến thư mục `frontend`, tiến hành cài đặt dependencies và chạy dev server:
```bash
cd frontend
npm install
npm run dev
```
Sau khi chạy thành công, truy cập giao diện web tại địa chỉ: **[http://localhost:5173](http://localhost:5173)**

---

## 🔑 Thông tin Demo & Tài khoản Thử nghiệm

### 1. Quản lý Tài khoản (Keycloak Admin)
Hệ thống sử dụng Keycloak để quản trị tài khoản tập trung:
- **Địa chỉ console**: `http://15.134.248.39:9090`
- **Tài khoản Admin**:
  - Username: `admin`
  - Password: `admin`
- **Realms**: `flash-ticket`

*Mẹo: Bạn có thể đăng ký tài khoản mới trực tiếp từ giao diện Frontend tại `http://localhost:5173/auth/register`, hệ thống sẽ tự động đồng bộ sang database của User Service thông qua RabbitMQ.*

### 2. Thông tin Thử nghiệm VNPay (Sandbox)
Khi thực hiện thanh toán vé sự kiện trên ứng dụng, bạn có thể chọn phương thức thanh toán VNPay và sử dụng thẻ test sau của ngân hàng NCB Sandbox để thanh toán demo:
- **Số thẻ**: `9704198526191432198`
- **Tên chủ thẻ**: `NGUYEN VAN A`
- **Ngày phát hành**: `07/15`
- **Mã OTP**: `123456`

---

## 🛠️ Một số lưu ý khi phát triển (Troubleshooting)

1. **Config Server không load được file config**:
   Config Server trong cấu hình local tìm kiếm các file cấu hình YAML tại thư mục: `file:./src/main/resources/config/`. Đảm bảo bạn chạy dự án từ đúng thư mục `configserver`.
2. **Cấp quyền chạy script trên Windows**:
   Nếu PowerShell báo lỗi không cho phép chạy script `run-all-services.ps1`, hãy chạy lệnh sau để cấp quyền tạm thời cho session hiện tại:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
   ```
3. **Thay đổi môi trường sang hoàn toàn Offline (Local DB)**:
   Nếu bạn muốn chạy database PostgreSQL, MongoDB và Keycloak trên máy của mình thay vì server demo từ xa, hãy sửa các địa chỉ IP `15.134.248.39` trong file `.env` thành `localhost` hoặc `127.0.0.1` và chạy lại Docker Compose.
