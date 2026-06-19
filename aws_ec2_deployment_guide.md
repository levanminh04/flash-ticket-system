# Cẩm Nang Triển Khai Hệ Thống Lên AWS EC2 & Nhật Ký Troubleshooting Toàn Diện (Flash Ticket System)

Tài liệu này cung cấp hướng dẫn chi tiết từng bước từ chuẩn bị hạ tầng, cấu trúc thư mục, cấu hình biến môi trường, đóng gói (Dockerization) cho tới triển khai toàn bộ hệ thống Microservices (Spring Boot + ReactJS + Databases/Middleware) lên máy chủ **AWS EC2** bằng phương pháp **Docker Compose Orchestration** kết hợp **Nginx Reverse Proxy**.

Đặc biệt, tài liệu này lưu trữ **toàn bộ lịch sử xử lý sự cố (Troubleshooting & Architectural Decisions)** thực tế đã gặp phải trong quá trình đưa hệ thống lên môi trường production ổn định.

---

## 1. Mô Hình Kiến Trúc Triển Khai (Production Architecture)

Trong môi trường sản xuất (Production) trên AWS EC2, toàn bộ hệ thống được cô lập và vận hành qua mạng nội bộ Docker để đảm bảo an toàn bảo mật, hiệu năng cao và khả năng khôi phục nhanh:

```mermaid
graph TB
    User["Trình duyệt Client (Internet)"]
    subgraph AWS EC2 Server
        Nginx["Nginx Reverse Proxy<br/>(Port 80/443 SSL)"]
        React["React.js Static Content<br/>(/var/www/html/flash-ticket)"]
        GW["API Gateway Container<br/>(Port 8080)"]
        KC["Keycloak Auth Container<br/>(Port 9090)"]
        
        subgraph Backend Services Network (Docker Bridge: ubuntu_backend)
            EUR["Eureka Discovery (8761)"]
            CFG["Config Server (8888)"]
            CORE["Core Service (8081)"]
            USER["User Service (8082)"]
            DISC["Discovery Service - AI (8085)"]
        end

        subgraph Database & Middleware Network (Chung mạng ubuntu_backend)
            PG["PostgreSQL (5432) <br/>postgres_flash_ticket"]
            RD["Redis (6379) <br/>redis_flash_ticket"]
            RMQ["RabbitMQ (5672) <br/>rabbitmq_flash_ticket"]
            MG["MongoDB (27017) <br/>mongodb_flash_ticket"]
        end
    end

    User -->|HTTP/HTTPS| Nginx
    Nginx -->|Serves Static Files| React
    Nginx -->|Proxy /api/**| GW
    Nginx -->|Proxy /auth/**| KC
    
    GW --> EUR
    EUR <--> CORE & USER & DISC
    CORE & USER & DISC --> CFG
    
    CORE --> PG & RD & RMQ
    USER --> PG & RMQ
    DISC --> MG & RMQ
```

---

## 2. Chuẩn Bị Thư Mục & Cấu Trúc Đặt File (Local vs. EC2)

Để triển khai chuyên nghiệp, cấu trúc thư mục phải sạch sẽ, phân tách rõ ràng giữa mã nguồn Frontend, cấu hình dịch vụ Backend, và các file điều phối Docker.

### 2.1. So Sánh Cấu Trúc Thư Mục Local và EC2

```text
Local Workspace (Windows)                  EC2 Production Host (Ubuntu)
d:\Project\flash-ticket-system\            ~/flash-ticket-services/ (Thư mục chạy backend)
├── apigateway/                            ├── apigateway/ (Chứa Dockerfile + code)
├── configserver/                          ├── configserver/ (Chứa Dockerfile + config)
├── core-service/                          ├── core-service/ (Chứa Dockerfile + code)
├── discovery-service/                     ├── discovery-service/ (Chứa Dockerfile + code)
├── eureka/                                ├── eureka/ (Chứa Dockerfile + code)
├── user-service/                          ├── user-service/ (Chứa Dockerfile + code)
├── keycloak-rabbitmq-spi/                 ├── keycloak-rabbitmq-spi/
├── frontend/                              ├── docker-compose.apps.yml
│   ├── .env.production                    └── ...
│   ├── vite.config.ts
│   └── dist/ (Bản build tĩnh)           /var/www/html/flash-ticket/ (Thư mục chạy frontend)
├── docker-compose.apps.yml                ├── index.html
└── .env.production (được dọn sạch)        ├── assets/ (chứa js, css, images tĩnh)
                                           └── silent-check-sso.html
```

### 2.2. Lệnh Linux Khởi Tạo Thư Mục và Phân Quyền Trên EC2

Khi đăng nhập vào EC2 qua SSH (bằng MobaXterm, PuTTY hoặc Terminal), hãy chạy các lệnh sau để chuẩn bị thư mục phục vụ Nginx và Docker:

```bash
# 1. Tạo thư mục chứa mã nguồn ứng dụng microservices ở thư mục home
mkdir -p ~/flash-ticket-services

# 2. Tạo thư mục chứa static files của React Frontend phục vụ cho Nginx
sudo mkdir -p /var/www/html/flash-ticket

# 3. Phân quyền sở hữu thư mục React cho user 'ubuntu' để dễ dàng tải file lên qua SFTP/WinSCP
sudo chown -R ubuntu:ubuntu /var/www/html/flash-ticket

# 4. Phân quyền đọc ghi thực thi hợp lệ cho thư mục web tĩnh
sudo chmod -R 755 /var/www/html/flash-ticket
```

### 2.3. Hướng Dẫn Cấu Hấu Hình `.env` & `.env.production` Cho Frontend

Frontend ReactJS sử dụng **Vite** để đóng gói. Trong môi trường production, Vite cần nạp đúng các địa chỉ IP Public của EC2.

#### Tối Ưu Hóa Module Hóa Frontend
Để thư mục `frontend/` hoàn toàn độc lập và di động (Modular Design), chúng ta cấu hình file `.env.production` nằm ngay **bên trong** thư mục `frontend/`. 
Chỉnh sửa file `frontend/vite.config.ts` để Vite nạp biến môi trường từ thư mục hiện tại (`.`) thay vì thư mục cha (`..`):

```typescript
// frontend/vite.config.ts
export default defineConfig(({ mode }) => {
    const repoRoot = path.resolve(__dirname, '.') // Thay đổi từ '..' thành '.'
    const env = loadEnv(mode, repoRoot, '')
 
    return {
        envDir: '.', // Thay đổi từ '..' thành '.'
        plugins: [react()],
        // ...
    }
})
```

#### Nội dung file `frontend/.env.production` trên máy Windows local:
```properties
# Đi qua cổng Nginx 80 để bảo mật và tránh lỗi CORS (Không gọi trực tiếp cổng microservices)
VITE_API_GATEWAY_URL=http://15.134.248.39
VITE_KEYCLOAK_URL=http://15.134.248.39/auth

VITE_KEYCLOAK_REALM=flash-ticket
VITE_KEYCLOAK_CLIENT_ID=flash-ticket-frontend
```
*(Hãy thay `15.134.248.39` bằng IP Public thực tế của AWS EC2 của bạn).*

**Lưu ý cực kỳ quan trọng:** Sau khi cấu hình xong, mở terminal local tại thư mục `frontend/` và chạy lệnh:
```bash
npm run build
```
Vite sẽ biên dịch toàn bộ source code thành các file tĩnh nằm trong thư mục `frontend/dist/`. Bạn chỉ cần kéo thả toàn bộ nội dung **bên trong** thư mục `dist/` này đè lên thư mục `/var/www/html/flash-ticket/` trên máy chủ EC2.

### 2.4. Lưu Ý Về File `.env` Của Các Backend Services trên EC2

*   **Tại Local (IDE IntelliJ/Eclipse):** Bạn cần tạo file `.env` vật lý trong từng thư mục service con (`core-service/.env`, `user-service/.env`...) để nạp các biến cấu hình DB local cho ứng dụng chạy.
*   **Tại Production EC2 (Docker Compose):** 
    **Hoàn toàn KHÔNG CẦN bất kỳ file `.env` vật lý nào cả!**
    Thay vì quản lý hàng tá file ẩn phức tạp trên server, chúng ta sử dụng kiến trúc tập trung: Khai báo trực tiếp toàn bộ các biến cấu hình môi trường sản xuất trong mục `environment:` của file `docker-compose.apps.yml` (Chi tiết cấu hình ở mục 3). Điều này đảm bảo tính đóng gói cao, dễ bảo trì và cực kỳ bảo mật.

---

## 3. Cấu Hình Orchestration (`docker-compose.apps.yml`)

Để tránh xung đột với các tiến trình chạy ở local, chúng ta định nghĩa file `docker-compose.apps.yml` chuyên dụng cho môi trường AWS EC2. 

File này ánh xạ đúng các container trung gian (như `eureka-server`, `config-server`) và định nghĩa đầy đủ các biến môi trường cấu hình sản xuất để ghi đè cấu hình Spring Cloud Config:

```yaml
version: '3.8'

services:
  # ── EUREKA SERVER (DISCOVERY SERVICE) ──────────────────────────────────────
  eureka-server:
    build: ./eureka
    container_name: eureka-server
    ports:
      - "8761:8761"
    networks:
      - ec2-db-network
    restart: unless-stopped

  # ── CONFIG SERVER (NATIVE PROFILE FOR LOCAL CLASSPATH CONFIGS) ─────────────
  config-server:
    build: ./configserver
    container_name: config-server
    ports:
      - "8888:8888"
    environment:
      # Kích hoạt native profile để đọc cấu hình offline từ classpath tài nguyên
      SPRING_PROFILES_ACTIVE: prod,native
    networks:
      - ec2-db-network
    depends_on:
      - eureka-server
    restart: unless-stopped

  # ── SPRING API GATEWAY ─────────────────────────────────────────────────────
  api-gateway:
    build: ./apigateway
    container_name: api-gateway
    ports:
      - "8080:8080"
    environment:
      SPRING_PROFILES_ACTIVE: prod
      SPRING_CONFIG_IMPORT: configserver:http://config-server:8888
      REDIS_HOST: redis_flash_ticket
      EUREKA_SERVER_URL: http://eureka-server:8761/eureka/
      KEYCLOAK_ISSUER_URI: http://15.134.248.39/auth/realms/flash-ticket
      KEYCLOAK_JWK_SET_URI: http://keycloak-flash-ticket:8080/auth/realms/flash-ticket/protocol/openid-connect/certs
    networks:
      - ec2-db-network
    depends_on:
      - config-server
    restart: unless-stopped

  # ── CORE TICKET SERVICE ────────────────────────────────────────────────────
  core-service:
    build: ./core-service
    container_name: core-service
    ports:
      - "8081:8081"
    environment:
      SPRING_PROFILES_ACTIVE: prod
      SPRING_CONFIG_IMPORT: configserver:http://config-server:8888
      POSTGRES_URL: jdbc:postgresql://postgres_flash_ticket:5432/flash-ticket
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ticket@7#
      REDIS_HOST: redis_flash_ticket
      REDIS_PASSWORD: 
      RABBITMQ_HOST: rabbitmq_flash_ticket
      EUREKA_SERVER_URL: http://eureka-server:8761/eureka/
      KEYCLOAK_ISSUER_URI: http://15.134.248.39/auth/realms/flash-ticket
      MAIL_USERNAME: "5minhmanhme@gmail.com"
      MAIL_PASSWORD: "rlje tmew prrs xcej"
      CLOUDINARY_CLOUD_NAME: "dlt2w6g4a"
      CLOUDINARY_API_KEY: "542385157832814"
      CLOUDINARY_API_SECRET: "eJ0Qj1VzYfK_i1x2q2y_z_9"
    networks:
      - ec2-db-network
    depends_on:
      - config-server
    restart: unless-stopped

  # ── USER SERVICE ───────────────────────────────────────────────────────────
  user-service:
    build: ./user-service
    container_name: user-service
    ports:
      - "8082:8082"
    environment:
      SPRING_PROFILES_ACTIVE: prod
      SPRING_CONFIG_IMPORT: configserver:http://config-server:8888
      POSTGRES_URL: jdbc:postgresql://postgres_flash_ticket:5432/flash-ticket
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ticket@7#
      MONGODB_URI: mongodb://mongodb_flash_ticket:27017/ticketbox_users
      RABBITMQ_HOST: rabbitmq_flash_ticket
      EUREKA_SERVER_URL: http://eureka-server:8761/eureka/
      KEYCLOAK_ISSUER_URI: http://15.134.248.39/auth/realms/flash-ticket
    networks:
      - ec2-db-network
    depends_on:
      - config-server
    restart: unless-stopped

  # ── DISCOVERY SERVICE (AI & CHATBOT) ───────────────────────────────────────
  discovery-service:
    build: ./discovery-service
    container_name: discovery-service
    ports:
      - "8085:8085"
    environment:
      SPRING_PROFILES_ACTIVE: prod
      SPRING_CONFIG_IMPORT: configserver:http://config-server:8888
      POSTGRES_URL: jdbc:postgresql://postgres_flash_ticket:5432/flash-ticket?currentSchema=discovery_schema,public
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ticket@7#
      RABBITMQ_HOST: rabbitmq_flash_ticket
      EUREKA_SERVER_URL: http://eureka-server:8761/eureka/
      KEYCLOAK_ISSUER_URI: http://15.134.248.39/auth/realms/flash-ticket
    networks:
      - ec2-db-network
    depends_on:
      - config-server
    restart: unless-stopped

networks:
  ec2-db-network:
    name: ubuntu_backend # Sử dụng mạng cầu chung thực tế của máy chủ EC2
    external: true
```

---

## 4. Nâng Cấp Java Compile Target Lên JDK 24

Toàn bộ các dịch vụ Backend Spring Boot (v3.5.4) được định cấu hình target compiler là **Java 24** (`pom.xml` cấu hình `<java.version>24</java.version>`). Do đó, để tránh lỗi không tương thích Class Version lúc chạy, toàn bộ Dockerfile của các service đều được nâng cấp lên base image **JDK 24 (Eclipse Temurin)**.

### Dockerfile Tiêu Chuẩn Doanh Nghiệp (Multi-Stage Build)
Áp dụng cơ chế Multi-stage giúp ảnh build tĩnh cực kỳ nhẹ (~140MB thay vì 600MB) và bảo mật tuyệt đối do không chứa mã nguồn gốc hoặc compiler dependencies:

```dockerfile
# Stage 1: Biên dịch mã nguồn Java
FROM maven:3.9.6-eclipse-temurin-24-alpine AS build
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Đóng gói JRE tối giản để chạy ứng dụng
FROM eclipse-temurin:24-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
```
*(Áp dụng Dockerfile này cho toàn bộ 6 microservices: `eureka`, `configserver`, `apigateway`, `core-service`, `user-service`, `discovery-service`).*

---

## 5. Cài Đặt và Cấu Hình Nginx Reverse Proxy

Nginx đóng vai trò là chốt chặn nhận diện cổng ngoài (Port 80/443), tự động trả về React Frontend tĩnh hoặc định tuyến chính xác (Proxy) các request API và Auth vào các container chạy ngầm.

### 5.1. Cài Đặt Nginx trên EC2
```bash
sudo apt update && sudo apt install nginx -y
```

### 5.2. Tạo Cấu Hình Server Block
Tạo file cấu hình mới tại `/etc/nginx/sites-available/flash-ticket`:
```bash
sudo nano /etc/nginx/sites-available/flash-ticket
```

Dán nội dung cấu hình chuẩn hóa sau vào:
```nginx
server {
    listen 80;
    server_name 15.134.248.39; # Điền IP Public của EC2 hoặc Domain của bạn

    # 1. Phục vụ ReactJS Frontend Tĩnh từ thư mục đã cấu hình
    location / {
        root /var/www/html/flash-ticket;
        index index.html index.htm;
        try_files $uri $uri/ /index.html; # Hỗ trợ tuyệt đối cơ chế React Router
    }

    # 2. Định tuyến API Gateway (Spring Cloud Gateway)
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 3. Định tuyến Keycloak Identity Server
    location = /auth {
        return 301 /auth/;
    }

    location /auth/ {
        proxy_pass http://localhost:9090; # Giữ nguyên prefix /auth khi chuyển tiếp vào Keycloak
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5.3. Kích Hoạt và Áp Dụng Cấu Hình
```bash
# Tạo liên kết symlink để kích hoạt cấu hình site mới
sudo ln -sf /etc/nginx/sites-available/flash-ticket /etc/nginx/sites-enabled/

# Hủy kích hoạt trang cấu hình mặc định (default) của Nginx để tránh xung đột cổng 80
sudo rm -f /etc/nginx/sites-enabled/default

# Kiểm tra cú pháp xem file cấu hình Nginx có bị lỗi gì không
sudo nginx -t

# Reload lại Nginx để áp dụng cấu hình mà không làm gián đoạn kết nối của người dùng
sudo systemctl reload nginx
```

---

## 6. Cẩm Nang Lệnh Linux & Vận Hành Hệ Thống Trên EC2

Dưới đây là tập hợp các lệnh Linux cốt lõi được sử dụng hàng ngày để quản trị, kiểm tra trạng thái và theo dõi hoạt động của hệ thống trên máy chủ EC2:

### 6.1. Triển Khai Code Mới (Deployment Workflow)
Khi bạn có thay đổi về code backend và muốn deploy lên EC2:
```bash
# Di chuyển vào thư mục dịch vụ trên EC2
cd ~/flash-ticket-services

# Tải code mới nhất từ Git Repo
git pull

# Biên dịch, build lại Docker Images và khởi chạy ngầm toàn bộ dịch vụ mới
docker compose -f docker-compose.apps.yml up -d --build
```

### 6.2. Giám Sát Hoạt Động Hệ Thống (Monitoring)
```bash
# 1. Kiểm tra trạng thái hoạt động của các container (Xem có cái nào bị Restart liên tục không)
docker ps

# 2. Xem log thời gian thực của một dịch vụ cụ thể (Ví dụ xem log của core-service)
docker logs -f --tail 100 core-service

# 3. Xem log thời gian thực của API Gateway để phát hiện các request bị lỗi
docker logs -f --tail 100 api-gateway

# 4. Kiểm tra các cổng mạng đang lắng nghe trên máy chủ
sudo netstat -tulpn
```

### 6.3. Xử Lý Sự Cố Khẩn Cấp (Emergency Ops)
```bash
# 1. Khởi động lại một container bị treo (Ví dụ core-service)
docker compose -f docker-compose.apps.yml restart core-service

# 2. Tắt hoàn toàn cụm microservices để giải phóng RAM
docker compose -f docker-compose.apps.yml down

# 3. Xem chi tiết thông số mạng nội bộ Docker
docker network inspect ubuntu_backend

# 4. Kết nối thủ công một container middleware vào mạng nội bộ (Khắc phục lỗi cô lập mạng)
docker network connect ubuntu_backend redis_flash_ticket
```

---

## 7. Nhật Ký Troubleshooting Lịch Sự (Toàn bộ 9 Sự cố nghiêm trọng)

Phần này tài liệu hóa chi tiết các lỗi "kinh điển" đã phát sinh trong suốt quá trình cài đặt thực tế, nguyên nhân sâu xa và phác đồ xử lý triệt để.

### 7.1. Sự cố 1: `config-server` sập liên tục (Crash Loop) do tìm kiếm Git URI
*   **Triệu chứng:** Khi chạy `docker compose up -d`, container `config-server` lập tức báo lỗi và thoát ra:
    ```text
    Description: Invalid config server configuration.
    Action: If you are using the git profile, you need to set a Git URI in your configuration.
    ```
*   **Nguyên nhân sâu xa:** Mặc định, Spring Cloud Config Server tìm kiếm cấu hình lưu trữ trên Git. Do ta đặt `SPRING_PROFILES_ACTIVE=prod` mà thiếu profile **`native`**, Spring Boot hiểu lầm phải sử dụng cấu hình Git nên crash vì không thấy Git URI khai báo.
*   **Giải pháp khắc phục:** Cập nhật biến môi trường cho `config-server` trong file `docker-compose.apps.yml` thành: `SPRING_PROFILES_ACTIVE: prod,native`. Điều này ép Config Server đọc offline từ file classpath tài nguyên `/config/`.

### 7.2. Sự cố 2: Lỗi Phân Giải Placeholder (`PlaceholderResolutionException`)
*   **Triệu chứng:** Khi khởi động, `core-service` ném biệt lệ và sập:
    ```text
    Caused by: org.springframework.util.PlaceholderResolutionException: Could not resolve placeholder 'REDIS_PASSWORD' in value "${REDIS_PASSWORD}"
    ```
*   **Nguyên nhân sâu xa:** Trong Spring Boot, cú pháp `${VAR}` biểu thị biến **bắt buộc** phải tồn tại trong hệ thống. Nếu không tìm thấy biến này (ở cả `.env`, hệ điều hành, hay compose), Spring Boot từ chối khởi chạy. Trong trường hợp này, Redis local chạy không mật khẩu nên biến `REDIS_PASSWORD` bị bỏ trống, dẫn đến crash hệ thống. Lỗi tương tự xảy ra với `MAIL_USERNAME` và `MAIL_PASSWORD`.
*   **Giải pháp khắc phục:** Trong file cấu hình Spring Cloud (`core-service.yml`), thêm dấu hai chấm `:` sau biến placeholder để định nghĩa giá trị mặc định là **rỗng (optional)**: `${REDIS_PASSWORD:}` và `${MAIL_USERNAME:}`.

### 7.3. Sự cố 3: Lỗi Keycloak `Invalid parameter: redirect_uri` và Token Mismatch
*   **Triệu chứng:** 
    1. Khi truy cập giao diện tĩnh ReactJS lần đầu, màn hình hiện lên chớp nhoáng rồi redirect về Keycloak báo lỗi: `Invalid parameter: redirect_uri`.
    2. Khi đăng nhập thành công, nhấn Đăng xuất (Logout) thì Keycloak báo lỗi: `Invalid redirect uri`. Nhấn "Back to Application" thì bị đá về `http://localhost:5173/`.
*   **Nguyên nhân sâu xa:** Keycloak có cơ chế bảo mật whitelisting cực kỳ nghiêm ngặt. Client `flash-ticket-frontend` trên Keycloak Admin Console vẫn đang giữ cấu hình mặc định là `localhost:5173`. Khi gọi Đăng xuất, token cũ lưu trên browser chứa trường `iss` (Issuer) trỏ đến cổng **`9090`** (vì trước đó gọi trực tiếp Keycloak cổng `9090`), trong khi ReactJS gửi yêu cầu logout trỏ đến Nginx cổng **`80`** (`http://15.134.248.39/auth/...`). Sự lệch pha cổng/domain giữa Token phát ra và URL logout làm Keycloak từ chối xác thực.
*   **Giải pháp khắc phục:**
    1. Truy cập Keycloak Admin UI (`http://15.134.248.39:9090`) -> Realm `flash-ticket` -> `Clients` -> `flash-ticket-frontend`.
    2. Cập nhật các trường sau để trỏ về IP Public chính xác:
        *   **Root URL:** `http://15.134.248.39`
        *   **Home URL:** `http://15.134.248.39`
        *   **Valid redirect URIs:** `http://15.134.248.39/*`
        *   **Valid post logout redirect URIs:** `http://15.134.248.39/*`
        *   **Admin URL:** Để trống hoàn toàn (Keycloak không cần dùng backchannel đối với SPA client).
    3. Làm sạch Cookie trình duyệt, chuyển đổi toàn bộ URL gọi từ ReactJS sang Nginx Reverse Proxy (Port 80) để đảm bảo đồng nhất `iss` là `http://15.134.248.39/auth`.

### 7.4. Sự cố 4: HTTP 405 Method Not Allowed khi gọi Token hoặc lỗi MIME Type
*   **Triệu chứng:** Khi truy cập trang login hoặc gọi API Token, trình duyệt nhận về response lỗi **`502 Bad Gateway`** hoặc **`405 Method Not Allowed`** hoặc console báo lỗi: `Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html"`.
*   **Nguyên nhân sâu xa:** Trong file React entrypoint `frontend/src/main.tsx`, ta có một đoạn code chặn request (Interceptor) đè lên `window.fetch` và `XMLHttpRequest` để chuyển Keycloak URL tĩnh thành đường dẫn tương đối nhằm tránh CORS lỗi. Interceptor cũ thực hiện lệnh: `input = input.replace(KC_ORIGIN, "")`. Khi ở môi trường production, `VITE_KEYCLOAK_URL` có giá trị kết thúc bằng `/auth` (ví dụ: `http://15.134.248.39/auth`). Lệnh `.replace()` trên đã xóa sạch cả hậu tố `/auth`, biến URL gọi từ `/auth/realms/...` thành `/realms/...`. Nginx chỉ nghe và proxy-pass những path bắt đầu bằng `/auth/` sang Keycloak. Các path dạng `/realms/` rơi vào khối root `/` của Nginx và trả về file React tĩnh `index.html`.
    *   Gửi POST request lấy token -> Trả về `index.html` -> Trình duyệt báo `405 Method Not Allowed` (Nginx không cho POST vào static file).
    *   Gửi GET request lấy JavaScript Keycloak -> Trả về `index.html` -> Trình duyệt báo `MIME type expected JS but got text/html`.
*   **Giải pháp khắc phục:** Sửa đổi code Interceptor trong `frontend/src/main.tsx` để giữ lại chính xác hậu tố `/auth` khi chạy môi trường production:
    ```typescript
    if (KC_ORIGIN) {
      const replacement = KC_ORIGIN.endsWith("/auth") ? "/auth" : "";
      const originalFetch = window.fetch;
      window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
        if (typeof input === "string" && input.startsWith(KC_ORIGIN)) {
          input = input.replace(KC_ORIGIN, replacement);
        }
        return originalFetch(input, init);
      };
    }
    ```

### 7.5. Sự cố 5: Lỗi kết nối Cơ sở dữ liệu và Middleware do "Khác Mạng" (Docker Network Isolation)
*   **Triệu chứng:** Core service sập hoặc API Gateway trả về `503 Service Unavailable / Core service is slow or unavailable` kèm theo log sập kết nối database:
    ```text
    Caused by: java.net.ConnectException: Connection refused
    at org.redisson.connection.SingleConnectionManager.connect
    ```
*   **Nguyên nhân sâu xa:** Môi trường Database & Middleware (`redis_flash_ticket`, `postgres_flash_ticket`...) được dựng từ một docker-compose độc lập trước đó, nên Docker tự động đặt chúng vào một mạng riêng. Trong khi đó, cụm microservices mới nằm ở mạng `ubuntu_backend`. Vì khác mạng Docker, các microservices không thể phân giải DNS của các container database mặc dù đã cấu hình đúng tên.
*   **Giải pháp khắc phục:** Chạy lệnh thủ công trên EC2 để gom các database container vào chung mạng `ubuntu_backend` của ứng dụng:
    ```bash
    docker network connect ubuntu_backend redis_flash_ticket
    docker network connect ubuntu_backend postgres_flash_ticket
    ```

### 7.6. Sự cố 6: Eureka Client gọi localhost:8761 bị từ chối do hardcode
*   **Triệu chứng:** Trong log của `core-service` xuất hiện liên tục lỗi: `Connect to http://localhost:8761 failed: Connection refused`.
*   **Nguyên nhân sâu xa:** Mặc dù đã cấu hình biến môi trường `EUREKA_SERVER_URL: http://eureka-server:8761/eureka/` trong file docker-compose, duy nhất trong file cấu hình gốc **`core-service.yml`**, địa chỉ Eureka Client lại bị hardcode cứng là: `defaultZone: http://localhost:8761/eureka/` thay vì sử dụng placeholder động.
*   **Giải pháp khắc phục:** Thay đổi cấu hình `defaultZone` trong `core-service.yml` thành:
    ```yaml
    eureka:
      client:
        serviceUrl:
          defaultZone: ${EUREKA_SERVER_URL:http://localhost:8761/eureka/}
    ```

### 7.7. Sự cố 7: Keycloak Logout báo lỗi `Invalid redirect uri` khi quay về trang chủ
*   **Triệu chứng:** Người dùng đăng nhập bình thường, nhưng khi bấm Đăng xuất thì trình duyệt chuyển hướng đến trang báo lỗi của Keycloak: `Invalid redirect uri`.
*   **Nguyên nhân sâu xa:** Keycloak phân biệt rạch ròi cơ chế bảo mật. Trường đăng nhập sử dụng whitelisting ở mục **`Valid Redirect URIs`**, còn trường đăng xuất sử dụng whitelisting ở mục **`Valid post logout redirect URIs`**. Mục này ban đầu chỉ khai báo local `http://localhost:5173/*` mà chưa được cập nhật IP của EC2.
*   **Giải pháp khắc phục:** Mở trang quản trị Keycloak Admin -> Chọn Client `flash-ticket-frontend` -> Tại mục **`Valid post logout redirect URIs`**, bổ sung thêm URL: `http://15.134.248.39/*` rồi nhấn Save.

### 7.8. Sự cố 8: Lỗi đồng bộ ghế / Race condition và Database locking (`PESSIMISTIC_WRITE`)
*   **Triệu chứng:** Khi nhiều người dùng cùng thanh toán hoặc đồng bộ sơ đồ ghế (seat map sync) cùng lúc, dữ liệu bị sai lệch, trạng thái ghế bị ghi đè không kiểm soát.
*   **Nguyên nhân sâu xa:** Thiếu cơ chế khóa bi quan (Pessimistic Locking) ở tầng database khi đọc và ghi sơ đồ ghế, dẫn đến hiện tượng Race Condition (Cạnh tranh tài nguyên).
*   **Giải pháp khắc phục:** Định nghĩa lại phương thức `findByEventIdForUpdate` với annotation `@Lock(LockModeType.PESSIMISTIC_WRITE)` trong `EventLayoutRepository.java` để thực thi câu lệnh SQL `SELECT ... FOR UPDATE`, khóa cứng bản ghi layout sự kiện cho đến khi transaction hiện tại kết thúc:
    ```java
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT el FROM EventLayout el WHERE el.event.id = :eventId")
    Optional<EventLayout> findByEventIdForUpdate(@Param("eventId") UUID eventId);
    ```

### 7.9. Sự cố 9: Lỗi biên dịch Hibernate JPQL do mapping sai thuộc tính lồng nhau
*   **Triệu chứng:** Ứng dụng `core-service` bị crash lúc khởi động hoặc ném lỗi cú pháp khi gọi repository:
    ```text
    org.hibernate.query.SemanticException: Could not resolve attribute 'eventId' of 'com.flashticket.core.event.entity.EventLayout'
    ```
*   **Nguyên nhân sâu xa:** Thực thể `EventLayout` lưu trữ quan hệ One-to-One lồng nhau với thực thể `Event` thông qua thuộc tính `@OneToOne Event event;`. Do đó, trong câu lệnh JPQL, việc truy vấn trực tiếp thuộc tính không tồn tại `el.eventId` là sai cú pháp Hibernate.
*   **Giải pháp khắc phục:** Chỉnh sửa câu lệnh JPQL trong `EventLayoutRepository` trỏ đúng vào thuộc tính định danh lồng nhau của thực thể liên kết: **`el.event.id`** thay vì `el.eventId`.

### 7.10. Sự cố 10: Vòng lặp crash (Crash Loop) do khởi động Config Server và Gateway/Microservices cùng lúc
*   **Triệu chứng:** Khi chạy lệnh `docker compose up -d`, các dịch vụ `api-gateway`, `core-service`, `user-service` bị sập ngay lập tức (Status: Exited), log hiển thị lỗi không thể kết nối tới Config Server:
    ```text
    java.lang.IllegalStateException: Could not locate PropertySource and the fail fast property is set, failing
    Caused by: org.springframework.web.client.ResourceAccessException: I/O error on GET request for "http://config-server:8888/...": Connection refused
    ```
*   **Nguyên nhân sâu xa:** Vì các service được cấu hình thuộc tính `spring.cloud.config.fail-fast=true`, chúng bắt buộc phải kết nối thành công tới Config Server ngay ở giai đoạn bootstrap để nạp cấu hình, nếu không sẽ tự động tắt ngầm ngay.
    Mặc dù file `docker-compose.apps.yml` có khai báo `depends_on: - config-server`, Docker Compose theo mặc định chỉ đảm bảo container `config-server` đã **bắt đầu khởi chạy** (started) chứ không đảm bảo ứng dụng Spring Boot bên trong đã **sẵn sàng nhận kết nối** (healthy state). Config Server mất khoảng 15-20 giây để khởi động hoàn chỉnh Spring Application Context. Trong thời gian này, Gateway/Core/User service khởi động lên trước và nỗ lực gọi Config Server dẫn đến Connection Refused và sập.
*   **Giải pháp khắc phục:**
    *   **Giải pháp 1 (Manual - Khuyên dùng khi chạy thủ công):** Triển khai khởi động theo trình tự. Bật Eureka và Config Server trước, đợi Config Server chạy xong rồi mới khởi động các dịch vụ còn lại:
        ```bash
        # 1. Bật eureka-server và config-server trước
        docker compose -f docker-compose.apps.yml up -d eureka-server config-server
        
        # 2. Theo dõi log cho tới khi Config Server sẵn sàng
        docker logs -f config-server | grep "Started ConfigServerApplication"
        
        # 3. Sau khi Config Server khởi động xong, bật toàn bộ các services còn lại
        docker compose -f docker-compose.apps.yml up -d
        ```
    *   **Giải pháp 2 (Automated Healthcheck):** Thêm cơ chế Spring Boot Actuator Healthcheck cho `config-server` trong compose file và định cấu hình `depends_on` của Gateway/Microservices ở dạng ràng buộc điều kiện sức khỏe:
        ```yaml
        config-server:
          ...
          healthcheck:
            test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8888/actuator/health"]
            interval: 5s
            timeout: 5s
            retries: 5
            start_period: 15s
        ```
        Và ở các service phụ thuộc:
        ```yaml
        depends_on:
          config-server:
            condition: service_healthy
        ```

### 7.11. Sự cố 11: Lỗi `Could not obtain the keys` và `404 Not Found` từ GET `/auth/realms/.../certs` của Keycloak
*   **Triệu chứng:** Khi gửi request yêu cầu xác thực (như `POST /api/chat`), API Gateway hoặc các service khác trả về lỗi `500 Server Error` và ném biệt lệ:
    ```text
    java.lang.IllegalStateException: Could not obtain the keys
    ...
    Caused by: org.springframework.web.reactive.function.client.WebClientResponseException$NotFound: 404 Not Found from GET http://15.134.248.39:9090/auth/realms/flash-ticket/protocol/openid-connect/certs
    ```
*   **Nguyên nhân sâu xa:** 
    1. Keycloak phiên bản mới (v17+) chạy trong Docker container mặc định **không** sử dụng context path `/auth` (chạy trực tiếp ở root `/realms/...`). Khi Nginx proxy-pass cổng 80 (`location /auth/`), nó đã cấu hình `proxy_pass http://localhost:9090/;` có dấu gạch chéo cuối để tự động loại bỏ chữ `/auth` trước khi đẩy về container Keycloak. Do đó Keycloak chỉ phân giải được các URL dạng `http://localhost:9090/realms/...`.
    2. Nếu các microservices (Gateway, Core, User...) cấu hình `jwk-set-uri` hoặc `issuer-uri` trỏ về IP công cộng và cổng trực tiếp `9090` kèm theo `/auth` (ví dụ: `http://15.134.248.39:9090/auth/realms/...`), yêu cầu này sẽ đi trực tiếp qua cổng 9090 (bỏ qua Nginx) nên Keycloak nhận nguyên cụm `/auth/...` và trả về `404 Not Found`.
    3. Hơn nữa, vì React Frontend đang gọi đăng nhập **trực tiếp tới cổng 9090 của Keycloak** (`http://15.134.248.39:9090`), nên Keycloak sinh ra Access Token có trường Issuer claim (`iss`) là `http://15.134.248.39:9090/realms/flash-ticket` (bắt buộc phải có cổng `:9090` và không có `/auth`). Nếu các microservice cấu hình thiếu cổng `:9090`, Spring Security sẽ so sánh và báo mâu thuẫn (`The iss claim is not valid`), từ chối Token ngay lập tức.
*   **Phương án tạm thời từng dùng:** 
    Có thể dùng **Mô hình Ánh xạ Kép (Dual-Mapping Architecture)** khi Keycloak vẫn phát token với issuer `:9090/realms/...`:
    *   **`issuer-uri`:** Trỏ về địa chỉ Public có cổng `:9090` để trùng khớp với claim `iss` trong Token thực tế: `http://15.134.248.39:9090/realms/flash-ticket`.
    *   **`jwk-set-uri`:** Trỏ trực tiếp về tên Container Keycloak trong mạng Docker nội bộ (`keycloak-flash-ticket:8080`) và không có `/auth/`: `http://keycloak-flash-ticket:8080/realms/flash-ticket/protocol/openid-connect/certs`. Cách này giúp các service lấy key nội bộ, bỏ qua internet loopback và tránh lỗi 404 do gọi nhầm `:9090/auth/...`.
    
    Cấu hình cập nhật đồng loạt trong file cấu hình `configserver` (`gateway-service-prod.yml`, `core-service-prod.yml`, `user-service-prod.yml`, `discovery-service-prod.yml`):
    ```yaml
    spring:
      security:
        oauth2:
          resourceserver:
            jwt:
              issuer-uri: http://15.134.248.39:9090/realms/flash-ticket
              jwk-set-uri: http://keycloak-flash-ticket:8080/realms/flash-ticket/protocol/openid-connect/certs
    ```
    *Lưu ý:* Sau khi cập nhật, cần rebuild và khởi động lại container `config-server` (hoặc kéo code và build lại trên EC2) vì `config-server` đóng gói dạng `native` nạp cấu hình từ `classpath:/config/`.
    **Quan trọng**: Sau khi cập nhật, bạn bắt buộc phải **Xóa sạch Cookies và Local Storage trên trình duyệt (hoặc mở Tab ẩn danh mới)** rồi đăng nhập lại để đảm bảo trình duyệt lấy Token mới chuẩn.

### 7.12. Ghi chú chuẩn hóa Keycloak public path về `/auth` sau sự cố mất trạng thái đăng nhập
> Mục này ghi lại hướng refactor đang được kiểm chứng để gom Keycloak về một public path ổn định qua Nginx: `http://15.134.248.39/auth`. Đây là tài liệu tham khảo theo bối cảnh hệ thống hiện tại, không phải khẳng định tuyệt đối cho mọi phiên bản/cách deploy Keycloak. Trước khi áp dụng backend/frontend theo hướng này, luôn xác nhận issuer thực tế bằng `.well-known/openid-configuration`.

*   **Triệu chứng ban đầu:** Local đăng nhập ổn, nhưng production trên EC2 bị mất trạng thái đăng nhập khi reload tab, đóng tab mở lại, hoặc bấm search ở navbar. Các route SPA như profile, vé của tôi, organizer ít bị hơn vì không reload toàn bộ trang.
*   **Nhận định kỹ thuật:** `keycloak-js` giữ access token/refresh token trong memory. Khi F5 hoặc dùng `window.location.href`, app reload và token memory mất; trạng thái login chỉ khôi phục được nếu `check-sso` đọc được cookie/session Keycloak. Khi public URL đi qua `/auth` nhưng Keycloak vẫn phát metadata/cookie theo `:9090/realms`, silent SSO dễ không khôi phục được.
*   **Cấu trúc URL mục tiêu:** Các lớp phải thống nhất về cùng một issuer public. Bảng dưới đây là cấu trúc mong muốn cho deployment EC2 hiện tại, trước khi chuyển sang domain/HTTPS:

    | Thành phần | URL cần khớp |
    | --- | --- |
    | Frontend Keycloak URL (`VITE_KEYCLOAK_URL`) | `http://15.134.248.39/auth` |
    | OIDC issuer trong `.well-known` | `http://15.134.248.39/auth/realms/flash-ticket` |
    | JWT claim `iss` trong access token mới | `http://15.134.248.39/auth/realms/flash-ticket` |
    | Backend `issuer-uri` | `http://15.134.248.39/auth/realms/flash-ticket` |
    | Backend `jwk-set-uri` nội bộ | `http://keycloak-flash-ticket:8080/auth/realms/flash-ticket/protocol/openid-connect/certs` |
    | User Service Keycloak Admin API nội bộ | `http://keycloak-flash-ticket:8080/auth` |

    `issuer-uri` là URL public vì Spring Security so sánh nó với claim `iss` trong token. `jwk-set-uri` có thể là URL nội bộ Docker vì backend chỉ cần lấy public key từ Keycloak; tuy nhiên path vẫn phải có `/auth` khi Keycloak đã chạy với `KC_HTTP_RELATIVE_PATH=/auth`.
*   **Dấu hiệu xác nhận lỗi path/issuer:** Gọi:
    ```bash
    curl -s http://15.134.248.39/auth/realms/flash-ticket/.well-known/openid-configuration | grep -o '"issuer":"[^"]*"'
    ```
    Nếu vẫn trả:
    ```text
    "issuer":"http://15.134.248.39:9090/realms/flash-ticket"
    ```
    thì Keycloak chưa thực sự public dưới `/auth`, dù Nginx có thể đang proxy được request `/auth/...`.

#### Cấu hình Keycloak container
Trong `docker-compose.yml` hạ tầng, cấu hình theo hướng minimum-diff, không thay đổi volume/database nếu không cần:
```yaml
keycloak:
  image: quay.io/keycloak/keycloak:26.0.0
  ports:
    - "9090:8080"
  environment:
    KEYCLOAK_ADMIN: admin
    KEYCLOAK_ADMIN_PASSWORD: admin

    KC_HTTP_ENABLED: "true"
    KC_HTTP_RELATIVE_PATH: /auth
    KC_HOSTNAME: http://15.134.248.39/auth
    KC_HOSTNAME_STRICT: "true"
    KC_PROXY_HEADERS: xforwarded
    KC_HOSTNAME_DEBUG: "true"

    # Giữ nguyên nếu setup hiện tại đang dùng; không đổi DB/storage trong cùng lần refactor path.
    KC_DB_URL_PROPERTIES: "?sslmode=disable"
  command: start-dev
  volumes:
    - keycloak_data:/opt/keycloak/data/
    - ./keycloak-rabbitmq-spi.jar:/opt/keycloak/providers/keycloak-rabbitmq-spi.jar
    - /home/ubuntu/flash-ticket:/opt/keycloak/themes/flash-ticket
```
*   **Không chạy** `docker compose down -v` trong quá trình này. Lệnh đó có thể xóa named volume như `ubuntu_keycloak_data`.
*   Recreate Keycloak sau khi sửa compose:
    ```bash
    docker compose up -d --force-recreate keycloak
    docker logs -f --tail=100 keycloak-flash-ticket
    ```
*   Lỗi đã gặp: `Provided hostname is neither a plain hostname nor a valid URL`. Nguyên nhân là cấu hình `KC_HOSTNAME: 15.134.248.39/auth` thiếu scheme. Sửa thành `KC_HOSTNAME: http://15.134.248.39/auth`.

#### Cấu hình Nginx
Khi Keycloak thật sự chạy dưới `/auth`, Nginx không được cắt prefix `/auth` nữa.
```nginx
location = /auth {
    return 301 /auth/;
}

location /auth/ {
    proxy_pass http://localhost:9090;
    proxy_http_version 1.1;

    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Port $server_port;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Real-IP $remote_addr;
}
```
*   Cấu hình cũ `proxy_pass http://localhost:9090/;` có dấu `/` cuối sẽ cắt `/auth` trước khi gửi vào Keycloak. Cách đó chỉ phù hợp với mô hình cũ: public giả `/auth`, Keycloak nội bộ chạy root `/`.
*   Sau khi sửa:
    ```bash
    sudo nginx -t
    sudo systemctl reload nginx
    sudo nginx -T | grep -n -A20 -B5 'location /auth'
    ```

#### Bẫy Realm Frontend URL
Sau khi `kc.sh show-config` đã hiển thị đúng:
```bash
docker exec keycloak-flash-ticket /opt/keycloak/bin/kc.sh show-config | grep -Ei 'hostname|http-relative|proxy'
```
có thể `.well-known` vẫn trả issuer `:9090/realms`. Khi đó kiểm tra:
```bash
curl -s http://localhost:9090/auth/realms/flash-ticket/hostname-debug
```
Nếu `Frontend/Backend/Admin` là `/auth` nhưng `Realm URL` vẫn là `http://15.134.248.39:9090`, nguyên nhân thường là Realm `flash-ticket` còn lưu **Frontend URL** cũ.

Cách sửa qua Admin UI:
```text
http://15.134.248.39/auth/admin
Realm: flash-ticket -> Realm settings -> General -> Frontend URL
```
Đổi từ:
```text
http://15.134.248.39:9090
```
sang:
```text
http://15.134.248.39/auth
```
Sau đó xác nhận lại:
```bash
curl -s http://15.134.248.39/auth/realms/flash-ticket/.well-known/openid-configuration | grep -o '"issuer":"[^"]*"'
```
Kết quả mong muốn tại thời điểm ghi chú này:
```text
"issuer":"http://15.134.248.39/auth/realms/flash-ticket"
```

#### Backend và frontend sau khi issuer đã đúng
Chỉ chuyển backend/frontend sang `/auth` sau khi `.well-known` thật sự trả issuer `/auth/realms/...`.

Backend prod config:
```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: http://15.134.248.39/auth/realms/flash-ticket
          jwk-set-uri: http://keycloak-flash-ticket:8080/auth/realms/flash-ticket/protocol/openid-connect/certs
```
Riêng User Service nếu gọi Keycloak Admin API nội bộ:
```yaml
keycloak:
  admin:
    server-url: http://keycloak-flash-ticket:8080/auth
```
Sau khi cập nhật config, rebuild/recreate `config-server` trước nếu config được đóng gói trong image, rồi restart gateway/core/user/discovery.

Frontend Vite:
```properties
VITE_API_GATEWAY_URL=http://15.134.248.39
VITE_KEYCLOAK_URL=http://15.134.248.39/auth
VITE_KEYCLOAK_REALM=flash-ticket
VITE_KEYCLOAK_CLIENT_ID=flash-ticket-frontend
```
Vite nhúng `VITE_*` vào bundle tại thời điểm build, nên phải build lại và upload lại `dist/`:
```bash
cd frontend
npm run build
```

#### Lưu ý tránh hiểu nhầm
*   Sửa `issuer-uri` ở backend không làm token tự đổi. Token mới chỉ đổi claim `iss` sau khi Keycloak thật sự phát issuer mới và user đăng nhập lại.
*   Token/cookie cũ có thể vẫn trỏ về `:9090`; nên test bằng tab ẩn danh hoặc clear cookie/local storage.
*   Search bằng `window.location.href` không phải nguyên nhân gốc của API search. Nó chỉ làm reload SPA, khiến token memory mất. Khi `check-sso` và cookie path Keycloak đã đúng, reload vẫn có thể khôi phục login từ SSO session.
*   Chưa nên đóng public port `9090` cho đến khi login, logout, refresh token, backend validate JWT, organizer/user APIs đều đã qua kiểm thử. Sau đó nên cân nhắc bind `9090` về localhost hoặc chặn Security Group để chỉ public qua Nginx.
*   Với production dài hạn, nên chuyển sang domain + HTTPS thay vì raw IP HTTP để giảm rủi ro cookie/browser policy và bảo mật token.
*   Tham khảo tài liệu chính thức khi nâng version Keycloak: reverse proxy, hostname v2 và securing apps. Các option cũ như `KC_PROXY=edge` có thể gây nhầm với `KC_PROXY_HEADERS=xforwarded` ở Keycloak mới.

---


## 8. Các Điểm Rà Soát Bảo Mật (Production Checklist)

1.  **AWS Security Group (Tối quan trọng):** Chỉ mở cổng **80** (HTTP), **443** (HTTPS) và cổng SSH bảo mật của bạn ra Internet. Tuyệt đối **không mở công khai** các cổng 8080 (Gateway), 8888 (Config Server), 8761 (Eureka), 5432 (Postgres), 6379 (Redis), 27017 (MongoDB) ra ngoài Internet để tránh bị hacker scan và tấn công.
2.  **Làm Sạch Token & Cookies:** Luôn hướng dẫn người dùng xóa lịch sử duyệt web hoặc mở tab ẩn danh khi chuyển dịch môi trường từ Local sang Production để tránh lưu đè cơ chế Cookie Token của IP/Cổng cũ.
3.  **Tách Biệt Cấu Hình Nhạy Cảm:** Mật khẩu Email App, Cloudinary Secret, Postgres Password nên được lưu trữ thông qua biến môi trường truyền từ docker compose thay vì hardcode trực tiếp vào source code đẩy lên Git public.
