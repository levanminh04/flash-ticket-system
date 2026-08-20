# Flash Ticket Android

Ứng dụng Android native của Flash Ticket System, được xây dựng bằng Kotlin và Jetpack Compose. Ứng dụng dùng chung cho ba nhóm người dùng: Buyer, Organizer và Admin, đồng thời tích hợp với backend hiện có thông qua API Gateway.

## Công nghệ chính

- Kotlin và Jetpack Compose.
- Kiến trúc MVVM kết hợp Unidirectional Data Flow.
- Keycloak/OIDC cho xác thực.
- Retrofit/OkHttp cho kết nối API.
- Room/SQLite cho dữ liệu cục bộ.
- CameraX và ML Kit cho quét QR.

## Cấu trúc tổng quan

```text
mobile-app/
├─ app/            # Điểm khởi chạy và điều hướng ứng dụng
├─ feature/
│  ├─ common/      # Chức năng dùng chung
│  ├─ buyer/       # Chức năng Buyer
│  ├─ organizer/   # Chức năng Organizer
│  └─ admin/       # Chức năng Admin
├─ core/           # Thành phần hạ tầng và dùng chung
└─ gradle/         # Cấu hình build khi scaffold
```

## Trạng thái

Hiện tại thư mục mới được khởi tạo ở mức skeleton. Gradle project và source Android sẽ được scaffold sau khi các quyết định phiên bản công nghệ được chốt.

Các file `.gitkeep` chỉ dùng để giữ thư mục rỗng trong Git và có thể xóa khi source code được thêm vào.

## Tài liệu

Thông tin chi tiết về phạm vi, kiến trúc, API, bảo mật, database, kiểm thử và kế hoạch triển khai nằm tại:

- [Bộ tài liệu mobile](../docs/mobile/README.md)
- [Kiến trúc và cấu trúc thư mục](../docs/mobile/02-architecture-and-folder-structure.md)

