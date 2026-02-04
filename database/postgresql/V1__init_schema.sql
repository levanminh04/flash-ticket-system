-- ============================================================================
-- TICKETBOX DATABASE SCHEMA - SCALE-READY DESIGN
-- ============================================================================
-- Version: 1.0.0
-- Database: PostgreSQL 14+
-- Author: TicketBox Team
-- 
-- DESIGN PRINCIPLES:
-- 1. Schema Isolation: Each module has its own schema (event_schema, booking_schema, payment_schema)
-- 2. UUID Primary Keys: For easy sharding and data merging
-- 3. Audit Columns: created_at, updated_at, created_by, updated_by, is_deleted
-- 4. Logical References: Cross-schema references without hard FK constraints
-- 5. pgvector Support: For AI/RAG features
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";       -- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "vector";         -- pgvector cho AI embeddings

-- ============================================================================
-- SCHEMA CREATION
-- ============================================================================
-- Mỗi schema tương ứng với một module trong Modular Monolith
-- Khi scale lên Microservices, chỉ cần migrate schema sang database riêng

CREATE SCHEMA IF NOT EXISTS event_schema;
CREATE SCHEMA IF NOT EXISTS booking_schema;
CREATE SCHEMA IF NOT EXISTS payment_schema;
CREATE SCHEMA IF NOT EXISTS ai_schema;

-- Set default search path
SET search_path TO public, event_schema, booking_schema, payment_schema, ai_schema;

-- ============================================================================
-- ============================================================================
--                           EVENT_SCHEMA
-- ============================================================================
-- Module quản lý: Sự kiện, Loại vé, Địa điểm, Danh mục
-- Owner: Event Module trong Core Service
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: event_schema.categories
-- Mô tả: Danh mục sự kiện (Concert, Workshop, Sport, Theater, etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE event_schema.categories (
    -- Primary Key: UUID để tránh trùng khi merge data từ nhiều nguồn
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Business Fields
    name VARCHAR(100) NOT NULL,                  -- Tên danh mục: "Concert", "Workshop"
    slug VARCHAR(100) NOT NULL UNIQUE,           -- URL-friendly: "concert", "workshop"
    description TEXT,                            -- Mô tả chi tiết danh mục
    icon_url VARCHAR(500),                       -- Icon hiển thị trên UI
    display_order INT DEFAULT 0,                 -- Thứ tự hiển thị trên menu
    is_active BOOLEAN DEFAULT TRUE,              -- Có hiển thị trên UI không
    
    -- Parent category for hierarchical structure (self-referencing)
    parent_id UUID REFERENCES event_schema.categories(id) ON DELETE SET NULL,
    
    -- Audit Columns (bắt buộc cho mọi bảng quan trọng)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(255),                     -- UUID của user từ User Service
    updated_by VARCHAR(255),
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL    -- Soft delete: không xóa vật lý
);

-- Index cho query phổ biến
CREATE INDEX idx_categories_parent ON event_schema.categories(parent_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_categories_active ON event_schema.categories(is_active) WHERE is_deleted = FALSE;

COMMENT ON TABLE event_schema.categories IS 'Danh mục sự kiện - phân loại theo Concert, Workshop, Sport, etc.';
COMMENT ON COLUMN event_schema.categories.slug IS 'URL-friendly identifier, dùng cho SEO và routing';

-- ----------------------------------------------------------------------------
-- Table: event_schema.venues
-- Mô tả: Địa điểm tổ chức sự kiện
-- ----------------------------------------------------------------------------
CREATE TABLE event_schema.venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Business Fields
    name VARCHAR(255) NOT NULL,                  -- Tên địa điểm: "Nhà hát Lớn Hà Nội"
    slug VARCHAR(255) NOT NULL UNIQUE,           -- URL-friendly
    description TEXT,                            -- Mô tả chi tiết
    
    -- Address Information
    address TEXT NOT NULL,                       -- Địa chỉ đầy đủ
    ward VARCHAR(100),                           -- Phường/Xã
    district VARCHAR(100),                       -- Quận/Huyện
    city VARCHAR(100) NOT NULL,                  -- Thành phố: "Hà Nội", "TP.HCM"
    country VARCHAR(100) DEFAULT 'Vietnam',
    postal_code VARCHAR(20),
    
    -- Geo Location (cho tìm kiếm theo vị trí)
    latitude DECIMAL(10, 8),                     -- Vĩ độ: 21.02888
    longitude DECIMAL(11, 8),                    -- Kinh độ: 105.85139
    
    -- Capacity & Facilities
    capacity INT,                                -- Sức chứa tối đa
    facilities JSONB DEFAULT '[]',               -- Tiện ích: ["Wifi", "Parking", "AC"]
    
    -- Media
    image_urls JSONB DEFAULT '[]',               -- Danh sách ảnh địa điểm
    
    -- Contact
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    website_url VARCHAR(500),
    
    -- Status
    is_verified BOOLEAN DEFAULT FALSE,           -- Địa điểm đã được verify
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit Columns
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

-- Indexes
CREATE INDEX idx_venues_city ON event_schema.venues(city) WHERE is_deleted = FALSE;
CREATE INDEX idx_venues_location ON event_schema.venues(latitude, longitude) WHERE is_deleted = FALSE;
CREATE INDEX idx_venues_active ON event_schema.venues(is_active) WHERE is_deleted = FALSE;

COMMENT ON TABLE event_schema.venues IS 'Địa điểm tổ chức sự kiện - hỗ trợ geo-search';
COMMENT ON COLUMN event_schema.venues.facilities IS 'JSON array các tiện ích: ["Wifi", "Parking", "Food Court"]';

-- ----------------------------------------------------------------------------
-- Table: event_schema.events
-- Mô tả: Sự kiện chính - bảng core của hệ thống
-- ----------------------------------------------------------------------------
CREATE TABLE event_schema.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic Information
    title VARCHAR(255) NOT NULL,                 -- Tiêu đề: "Rock Storm 2026"
    slug VARCHAR(255) NOT NULL UNIQUE,           -- URL: "rock-storm-2026"
    short_description VARCHAR(500),              -- Mô tả ngắn cho listing
    description TEXT,                            -- Mô tả đầy đủ (có thể HTML/Markdown)
    
    -- Categorization
    category_id UUID REFERENCES event_schema.categories(id) ON DELETE SET NULL,
    tags JSONB DEFAULT '[]',                     -- Tags: ["rock", "music", "outdoor"]
    
    -- Schedule
    start_datetime TIMESTAMPTZ NOT NULL,         -- Thời gian bắt đầu
    end_datetime TIMESTAMPTZ NOT NULL,           -- Thời gian kết thúc
    timezone VARCHAR(50) DEFAULT 'Asia/Ho_Chi_Minh',
    
    -- Location (FK trong cùng schema - OK để dùng hard constraint)
    venue_id UUID REFERENCES event_schema.venues(id) ON DELETE SET NULL,
    online_event_url VARCHAR(500),               -- URL nếu là event online
    is_online BOOLEAN DEFAULT FALSE,             -- Event online hay offline
    
    -- Organizer (LOGICAL REFERENCE - không dùng FK vì user ở MongoDB)
    organizer_id VARCHAR(255) NOT NULL,          -- UUID của Organizer từ User Service
    organizer_name VARCHAR(255),                 -- Cache tên để tránh query User Service
    organizer_logo_url VARCHAR(500),             -- Cache logo
    
    -- Media
    banner_image_url VARCHAR(500),               -- Ảnh banner chính
    thumbnail_url VARCHAR(500),                  -- Ảnh thumbnail cho listing
    gallery_urls JSONB DEFAULT '[]',             -- Gallery ảnh
    
    -- Ticket Configuration
    min_tickets_per_order INT DEFAULT 1,         -- Số vé tối thiểu mỗi đơn
    max_tickets_per_order INT DEFAULT 10,        -- Số vé tối đa mỗi đơn
    
    -- Sales Window
    sale_start_datetime TIMESTAMPTZ,             -- Thời điểm mở bán vé
    sale_end_datetime TIMESTAMPTZ,               -- Thời điểm đóng bán vé
    
    -- Status & Visibility
    status VARCHAR(50) DEFAULT 'DRAFT' NOT NULL, -- DRAFT, PUBLISHED, CANCELLED, COMPLETED, SOLD_OUT
    visibility VARCHAR(50) DEFAULT 'PUBLIC',     -- PUBLIC, PRIVATE, UNLISTED
    is_featured BOOLEAN DEFAULT FALSE,           -- Hiển thị ở banner nổi bật
    
    -- Statistics (denormalized for performance)
    total_capacity INT DEFAULT 0,                -- Tổng sức chứa (sum từ ticket_types)
    tickets_sold INT DEFAULT 0,                  -- Số vé đã bán
    view_count INT DEFAULT 0,                    -- Lượt xem
    
    -- SEO
    meta_title VARCHAR(255),
    meta_description VARCHAR(500),
    meta_keywords VARCHAR(255),
    
    -- Audit Columns
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    deleted_at TIMESTAMPTZ,                      -- Thời điểm soft delete
    
    -- Constraints
    CONSTRAINT chk_event_dates CHECK (end_datetime > start_datetime),
    CONSTRAINT chk_event_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED', 'SOLD_OUT')),
    CONSTRAINT chk_event_visibility CHECK (visibility IN ('PUBLIC', 'PRIVATE', 'UNLISTED'))
);

-- Indexes cho các query phổ biến
CREATE INDEX idx_events_category ON event_schema.events(category_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_events_venue ON event_schema.events(venue_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_events_organizer ON event_schema.events(organizer_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_events_status ON event_schema.events(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_events_datetime ON event_schema.events(start_datetime) WHERE is_deleted = FALSE AND status = 'PUBLISHED';
CREATE INDEX idx_events_featured ON event_schema.events(is_featured) WHERE is_deleted = FALSE AND status = 'PUBLISHED';
CREATE INDEX idx_events_slug ON event_schema.events(slug);

-- Full-text search index (cho tìm kiếm event)
CREATE INDEX idx_events_search ON event_schema.events 
    USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(short_description, '')));

COMMENT ON TABLE event_schema.events IS 'Sự kiện chính - core entity của hệ thống bán vé';
COMMENT ON COLUMN event_schema.events.organizer_id IS 'Logical reference tới User Service (MongoDB) - không dùng FK';
COMMENT ON COLUMN event_schema.events.tickets_sold IS 'Denormalized field - cập nhật qua trigger hoặc async job';

-- ----------------------------------------------------------------------------
-- Table: event_schema.ticket_types
-- Mô tả: Loại vé của mỗi sự kiện (VIP, Regular, Early Bird, etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE event_schema.ticket_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Parent Event (FK trong cùng schema - safe)
    event_id UUID NOT NULL REFERENCES event_schema.events(id) ON DELETE CASCADE,
    
    -- Basic Information
    name VARCHAR(100) NOT NULL,                  -- Tên loại vé: "VIP", "Regular"
    description TEXT,                            -- Mô tả quyền lợi của loại vé
    
    -- Pricing
    price DECIMAL(15, 2) NOT NULL,               -- Giá vé (VND)
    original_price DECIMAL(15, 2),               -- Giá gốc (nếu đang giảm giá)
    currency VARCHAR(3) DEFAULT 'VND',
    
    -- Inventory Management (CRITICAL cho Flash Sale)
    quantity_total INT NOT NULL,                 -- Tổng số vé loại này
    quantity_available INT NOT NULL,             -- Số vé còn lại (CẬP NHẬT QUA REDIS LOCK)
    quantity_reserved INT DEFAULT 0,             -- Số vé đang giữ chỗ (chưa thanh toán)
    max_per_order INT DEFAULT 10,                -- Giới hạn mua mỗi đơn
    
    -- Sales Window
    sale_start_datetime TIMESTAMPTZ,             -- Thời điểm mở bán loại vé này
    sale_end_datetime TIMESTAMPTZ,               -- Thời điểm đóng bán
    
    -- Display
    display_order INT DEFAULT 0,                 -- Thứ tự hiển thị
    color_code VARCHAR(7),                       -- Màu hiển thị: "#FF5733"
    
    -- Status
    status VARCHAR(50) DEFAULT 'ACTIVE',         -- ACTIVE, SOLD_OUT, HIDDEN
    is_visible BOOLEAN DEFAULT TRUE,             -- Có hiển thị trên UI không
    
    -- Audit Columns
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    
    -- Constraints
    CONSTRAINT chk_ticket_quantity CHECK (quantity_available >= 0 AND quantity_available <= quantity_total),
    CONSTRAINT chk_ticket_price CHECK (price >= 0),
    CONSTRAINT chk_ticket_status CHECK (status IN ('ACTIVE', 'SOLD_OUT', 'HIDDEN'))
);

-- Indexes
CREATE INDEX idx_ticket_types_event ON event_schema.ticket_types(event_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_ticket_types_status ON event_schema.ticket_types(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_ticket_types_available ON event_schema.ticket_types(quantity_available) 
    WHERE is_deleted = FALSE AND status = 'ACTIVE';

COMMENT ON TABLE event_schema.ticket_types IS 'Loại vé - quản lý inventory cho Flash Sale';
COMMENT ON COLUMN event_schema.ticket_types.quantity_available IS 'CRITICAL: Cập nhật qua Redis Distributed Lock để tránh overselling';
COMMENT ON COLUMN event_schema.ticket_types.quantity_reserved IS 'Số vé đang được giữ (pending payment) - release sau 15 phút';


-- ============================================================================
-- ============================================================================
--                           BOOKING_SCHEMA
-- ============================================================================
-- Module quản lý: Đơn hàng, Giỏ hàng, Vé đã xuất, Giữ chỗ
-- Owner: Booking Module trong Core Service
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: booking_schema.carts
-- Mô tả: Giỏ hàng của user (temporary, có thể expire)
-- ----------------------------------------------------------------------------
CREATE TABLE booking_schema.carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User (LOGICAL REFERENCE - không FK vì user ở MongoDB)
    user_id VARCHAR(255) NOT NULL,               -- UUID của user từ User Service
    session_id VARCHAR(255),                     -- Session cho guest checkout
    
    -- Expiration
    expires_at TIMESTAMPTZ,                      -- Thời điểm cart hết hạn
    
    -- Status
    status VARCHAR(50) DEFAULT 'ACTIVE',         -- ACTIVE, CONVERTED, EXPIRED, ABANDONED
    
    -- Audit Columns
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT chk_cart_status CHECK (status IN ('ACTIVE', 'CONVERTED', 'EXPIRED', 'ABANDONED'))
);

CREATE INDEX idx_carts_user ON booking_schema.carts(user_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_carts_expires ON booking_schema.carts(expires_at) WHERE status = 'ACTIVE';

COMMENT ON TABLE booking_schema.carts IS 'Giỏ hàng tạm thời - tự động expire sau 30 phút';

-- ----------------------------------------------------------------------------
-- Table: booking_schema.cart_items
-- Mô tả: Các item trong giỏ hàng
-- ----------------------------------------------------------------------------
CREATE TABLE booking_schema.cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Parent Cart
    cart_id UUID NOT NULL REFERENCES booking_schema.carts(id) ON DELETE CASCADE,
    
    -- Event & Ticket Type (LOGICAL REFERENCE - cross schema)
    -- KHÔNG dùng FK vì event_schema và booking_schema có thể tách riêng sau này
    event_id UUID NOT NULL,                      -- Reference tới event_schema.events
    ticket_type_id UUID NOT NULL,                -- Reference tới event_schema.ticket_types
    
    -- Denormalized data (cache để tránh join cross-schema)
    event_title VARCHAR(255),                    -- Cache từ events
    ticket_type_name VARCHAR(100),               -- Cache từ ticket_types
    unit_price DECIMAL(15, 2) NOT NULL,          -- Giá tại thời điểm add to cart
    
    -- Quantity
    quantity INT NOT NULL DEFAULT 1,
    
    -- Timestamps
    added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT chk_cart_item_quantity CHECK (quantity > 0)
);

CREATE INDEX idx_cart_items_cart ON booking_schema.cart_items(cart_id);
CREATE INDEX idx_cart_items_event ON booking_schema.cart_items(event_id);

COMMENT ON TABLE booking_schema.cart_items IS 'Items trong giỏ hàng - có cache data để tránh cross-schema join';
COMMENT ON COLUMN booking_schema.cart_items.event_id IS 'Logical reference tới event_schema.events - không dùng FK';

-- ----------------------------------------------------------------------------
-- Table: booking_schema.orders
-- Mô tả: Đơn hàng chính
-- ----------------------------------------------------------------------------
CREATE TABLE booking_schema.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Order Number (human readable, unique)
    order_number VARCHAR(50) NOT NULL UNIQUE,    -- VD: "ORD-20260205-XXXXX"
    
    -- Customer (LOGICAL REFERENCE)
    user_id VARCHAR(255) NOT NULL,               -- UUID từ User Service
    customer_email VARCHAR(255) NOT NULL,        -- Email để gửi vé
    customer_phone VARCHAR(20),                  -- Phone backup
    customer_name VARCHAR(255),                  -- Tên người mua
    
    -- Event (LOGICAL REFERENCE - cross schema)
    event_id UUID NOT NULL,                      -- Reference tới event_schema.events
    event_title VARCHAR(255),                    -- Cache để hiển thị
    event_start_datetime TIMESTAMPTZ,            -- Cache thời gian event
    event_venue_name VARCHAR(255),               -- Cache địa điểm
    
    -- Pricing
    subtotal DECIMAL(15, 2) NOT NULL,            -- Tổng tiền trước giảm giá
    discount_amount DECIMAL(15, 2) DEFAULT 0,    -- Số tiền giảm
    discount_code VARCHAR(50),                   -- Mã giảm giá đã dùng
    total_amount DECIMAL(15, 2) NOT NULL,        -- Tổng tiền phải thanh toán
    currency VARCHAR(3) DEFAULT 'VND',
    
    -- Status & Lifecycle
    status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
    -- PENDING: Chờ thanh toán
    -- CONFIRMED: Đã thanh toán
    -- CANCELLED: Đã hủy (customer hoặc system)
    -- REFUNDED: Đã hoàn tiền
    -- EXPIRED: Hết hạn thanh toán
    
    -- Payment Tracking (LOGICAL REFERENCE tới payment_schema)
    payment_method VARCHAR(50),                  -- VNPAY, MOMO, BANK_TRANSFER
    paid_at TIMESTAMPTZ,                         -- Thời điểm thanh toán thành công
    
    -- Expiration (cho pending orders)
    expires_at TIMESTAMPTZ,                      -- Order hết hạn sau 15 phút
    
    -- Notes
    customer_note TEXT,                          -- Ghi chú của khách
    internal_note TEXT,                          -- Ghi chú nội bộ
    
    -- Source Tracking
    source VARCHAR(50) DEFAULT 'WEB',            -- WEB, MOBILE_APP, ADMIN
    ip_address VARCHAR(45),                      -- IPv4 hoặc IPv6
    user_agent TEXT,                             -- Browser info
    
    -- Audit Columns
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    cancelled_at TIMESTAMPTZ,
    cancelled_by VARCHAR(255),
    cancellation_reason TEXT,
    
    CONSTRAINT chk_order_status CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED', 'EXPIRED')),
    CONSTRAINT chk_order_amount CHECK (total_amount >= 0)
);

-- Indexes cho các query pattern phổ biến
CREATE INDEX idx_orders_user ON booking_schema.orders(user_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_orders_event ON booking_schema.orders(event_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_orders_status ON booking_schema.orders(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_orders_number ON booking_schema.orders(order_number);
CREATE INDEX idx_orders_created ON booking_schema.orders(created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_orders_expires ON booking_schema.orders(expires_at) WHERE status = 'PENDING';
CREATE INDEX idx_orders_email ON booking_schema.orders(customer_email) WHERE is_deleted = FALSE;

COMMENT ON TABLE booking_schema.orders IS 'Đơn hàng chính - core entity của booking module';
COMMENT ON COLUMN booking_schema.orders.event_id IS 'Logical reference tới event_schema - không dùng FK để dễ tách service';
COMMENT ON COLUMN booking_schema.orders.expires_at IS 'Order pending sẽ auto-expire, trả vé về inventory';

-- ----------------------------------------------------------------------------
-- Table: booking_schema.order_items
-- Mô tả: Chi tiết từng loại vé trong đơn hàng
-- ----------------------------------------------------------------------------
CREATE TABLE booking_schema.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Parent Order (FK trong cùng schema - safe)
    order_id UUID NOT NULL REFERENCES booking_schema.orders(id) ON DELETE CASCADE,
    
    -- Ticket Type (LOGICAL REFERENCE - cross schema)
    ticket_type_id UUID NOT NULL,                -- Reference tới event_schema.ticket_types
    
    -- Denormalized data
    ticket_type_name VARCHAR(100),               -- VD: "VIP", "Regular"
    
    -- Quantity & Pricing
    quantity INT NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,          -- Giá tại thời điểm mua
    subtotal DECIMAL(15, 2) NOT NULL,            -- quantity * unit_price
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT chk_order_item_quantity CHECK (quantity > 0)
);

CREATE INDEX idx_order_items_order ON booking_schema.order_items(order_id);
CREATE INDEX idx_order_items_ticket_type ON booking_schema.order_items(ticket_type_id);

COMMENT ON TABLE booking_schema.order_items IS 'Chi tiết vé trong đơn hàng';

-- ----------------------------------------------------------------------------
-- Table: booking_schema.tickets
-- Mô tả: Vé đã xuất (sau khi thanh toán thành công) - có QR Code
-- ----------------------------------------------------------------------------
CREATE TABLE booking_schema.tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Ticket Code (unique, dùng cho QR)
    ticket_code VARCHAR(100) NOT NULL UNIQUE,    -- VD: "TKT-XXXXXXXX-XXXX"
    
    -- Parent Order
    order_id UUID NOT NULL REFERENCES booking_schema.orders(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES booking_schema.order_items(id) ON DELETE SET NULL,
    
    -- Event & Ticket Type (LOGICAL REFERENCE)
    event_id UUID NOT NULL,
    ticket_type_id UUID NOT NULL,
    
    -- Denormalized for quick access (display on ticket)
    event_title VARCHAR(255),
    event_start_datetime TIMESTAMPTZ,
    event_venue_name VARCHAR(255),
    event_venue_address TEXT,
    ticket_type_name VARCHAR(100),
    
    -- Holder Information
    holder_name VARCHAR(255),                    -- Tên người tham dự (nếu khác người mua)
    holder_email VARCHAR(255),
    holder_phone VARCHAR(20),
    
    -- Pricing
    price DECIMAL(15, 2) NOT NULL,               -- Giá vé này
    
    -- QR Code
    qr_code_data TEXT,                           -- Data encoded trong QR
    qr_code_image_url VARCHAR(500),              -- URL ảnh QR (nếu lưu S3)
    
    -- Check-in Status
    status VARCHAR(50) DEFAULT 'VALID' NOT NULL,
    -- VALID: Vé hợp lệ, chưa sử dụng
    -- USED: Đã check-in
    -- CANCELLED: Đã hủy
    -- TRANSFERRED: Đã chuyển nhượng
    
    checked_in_at TIMESTAMPTZ,                   -- Thời điểm check-in
    checked_in_by VARCHAR(255),                  -- Staff thực hiện check-in
    check_in_location VARCHAR(255),              -- Cửa/Gate check-in
    
    -- Transfer (nếu chuyển nhượng vé)
    is_transferable BOOLEAN DEFAULT TRUE,
    transferred_from_ticket_id UUID,             -- Vé gốc nếu là vé chuyển nhượng
    transferred_at TIMESTAMPTZ,
    
    -- Audit Columns
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    
    CONSTRAINT chk_ticket_status CHECK (status IN ('VALID', 'USED', 'CANCELLED', 'TRANSFERRED'))
);

-- Indexes
CREATE INDEX idx_tickets_code ON booking_schema.tickets(ticket_code);
CREATE INDEX idx_tickets_order ON booking_schema.tickets(order_id);
CREATE INDEX idx_tickets_event ON booking_schema.tickets(event_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_tickets_status ON booking_schema.tickets(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_tickets_holder_email ON booking_schema.tickets(holder_email) WHERE is_deleted = FALSE;

COMMENT ON TABLE booking_schema.tickets IS 'Vé đã xuất - có QR code để check-in';
COMMENT ON COLUMN booking_schema.tickets.ticket_code IS 'Unique code encode trong QR - dùng để check-in';
COMMENT ON COLUMN booking_schema.tickets.qr_code_data IS 'JSON data encode trong QR: {ticketCode, eventId, ...}';

-- ----------------------------------------------------------------------------
-- Table: booking_schema.reservations
-- Mô tả: Giữ chỗ tạm thời trong Flash Sale (trước khi thanh toán)
-- ----------------------------------------------------------------------------
CREATE TABLE booking_schema.reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Session tracking
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255),                     -- Để track reservation của guest
    
    -- What is being reserved
    event_id UUID NOT NULL,
    ticket_type_id UUID NOT NULL,
    quantity INT NOT NULL,
    
    -- Pricing at reservation time
    unit_price DECIMAL(15, 2) NOT NULL,
    
    -- Expiration (CRITICAL cho Flash Sale)
    expires_at TIMESTAMPTZ NOT NULL,             -- Thường là 15 phút
    
    -- Status
    status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL,
    -- ACTIVE: Đang giữ chỗ
    -- CONVERTED: Đã tạo order
    -- EXPIRED: Hết hạn, đã trả inventory
    -- RELEASED: User chủ động release
    
    -- Link to order if converted
    order_id UUID REFERENCES booking_schema.orders(id) ON DELETE SET NULL,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    released_at TIMESTAMPTZ,
    
    CONSTRAINT chk_reservation_status CHECK (status IN ('ACTIVE', 'CONVERTED', 'EXPIRED', 'RELEASED')),
    CONSTRAINT chk_reservation_quantity CHECK (quantity > 0)
);

-- Indexes
CREATE INDEX idx_reservations_user ON booking_schema.reservations(user_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_reservations_ticket_type ON booking_schema.reservations(ticket_type_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_reservations_expires ON booking_schema.reservations(expires_at) WHERE status = 'ACTIVE';

COMMENT ON TABLE booking_schema.reservations IS 'Giữ chỗ tạm cho Flash Sale - auto-release khi expire';
COMMENT ON COLUMN booking_schema.reservations.expires_at IS 'CRITICAL: Job chạy định kỳ release expired reservations, trả quantity về ticket_types';


-- ============================================================================
-- ============================================================================
--                           PAYMENT_SCHEMA
-- ============================================================================
-- Module quản lý: Giao dịch thanh toán, Refund, Payment history
-- Owner: Payment Module trong Core Service
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: payment_schema.transactions
-- Mô tả: Giao dịch thanh toán
-- ----------------------------------------------------------------------------
CREATE TABLE payment_schema.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Transaction Number
    transaction_number VARCHAR(100) NOT NULL UNIQUE, -- VD: "TXN-20260205-XXXXX"
    
    -- Order Link (LOGICAL REFERENCE - cross schema)
    order_id UUID NOT NULL,                      -- Reference tới booking_schema.orders
    order_number VARCHAR(50),                    -- Cache order number
    
    -- User
    user_id VARCHAR(255) NOT NULL,               -- Reference tới User Service
    
    -- Payment Details
    payment_method VARCHAR(50) NOT NULL,         -- VNPAY, MOMO, BANK_TRANSFER, COD
    payment_provider VARCHAR(50),                -- VNPay, MoMo, ViettelPay
    
    -- Amount
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'VND',
    
    -- Provider Response
    provider_transaction_id VARCHAR(255),        -- Transaction ID từ payment gateway
    provider_response_code VARCHAR(50),          -- Response code
    provider_response_message TEXT,              -- Response message
    provider_raw_response JSONB,                 -- Full response JSON để debug
    
    -- Bank Info (for VNPAY)
    bank_code VARCHAR(20),                       -- VCB, TCB, ACB...
    card_type VARCHAR(20),                       -- ATM, CREDIT, QRCODE
    
    -- Status
    status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
    -- PENDING: Đang chờ payment gateway
    -- SUCCESS: Thanh toán thành công
    -- FAILED: Thanh toán thất bại
    -- CANCELLED: User hủy thanh toán
    -- REFUNDED: Đã hoàn tiền
    
    -- Timestamps
    initiated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at TIMESTAMPTZ,
    
    -- Refund tracking
    is_refunded BOOLEAN DEFAULT FALSE,
    refund_amount DECIMAL(15, 2),
    refunded_at TIMESTAMPTZ,
    refund_reason TEXT,
    refund_transaction_id UUID,                  -- Self-reference cho refund transaction
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    
    CONSTRAINT chk_transaction_status CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED')),
    CONSTRAINT chk_transaction_amount CHECK (amount > 0)
);

-- Indexes
CREATE INDEX idx_transactions_order ON payment_schema.transactions(order_id);
CREATE INDEX idx_transactions_user ON payment_schema.transactions(user_id);
CREATE INDEX idx_transactions_status ON payment_schema.transactions(status);
CREATE INDEX idx_transactions_provider ON payment_schema.transactions(provider_transaction_id);
CREATE INDEX idx_transactions_created ON payment_schema.transactions(created_at DESC);

COMMENT ON TABLE payment_schema.transactions IS 'Lịch sử thanh toán - tích hợp VNPay, MoMo';
COMMENT ON COLUMN payment_schema.transactions.provider_raw_response IS 'Lưu full response để debug và đối soát';

-- ----------------------------------------------------------------------------
-- Table: payment_schema.refunds
-- Mô tả: Chi tiết hoàn tiền
-- ----------------------------------------------------------------------------
CREATE TABLE payment_schema.refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Original Transaction
    original_transaction_id UUID NOT NULL REFERENCES payment_schema.transactions(id),
    order_id UUID NOT NULL,                      -- Logical reference
    
    -- Refund Details
    refund_amount DECIMAL(15, 2) NOT NULL,
    refund_reason TEXT NOT NULL,
    refund_type VARCHAR(50) DEFAULT 'FULL',      -- FULL, PARTIAL
    
    -- Requested By
    requested_by VARCHAR(255) NOT NULL,          -- User hoặc Admin
    requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Processing
    status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
    -- PENDING: Chờ xử lý
    -- APPROVED: Đã duyệt, đang hoàn tiền
    -- COMPLETED: Hoàn tiền thành công
    -- REJECTED: Từ chối hoàn tiền
    
    processed_by VARCHAR(255),
    processed_at TIMESTAMPTZ,
    
    -- Provider Response
    provider_refund_id VARCHAR(255),
    provider_response JSONB,
    
    -- Notes
    admin_note TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT chk_refund_status CHECK (status IN ('PENDING', 'APPROVED', 'COMPLETED', 'REJECTED')),
    CONSTRAINT chk_refund_type CHECK (refund_type IN ('FULL', 'PARTIAL'))
);

CREATE INDEX idx_refunds_transaction ON payment_schema.refunds(original_transaction_id);
CREATE INDEX idx_refunds_order ON payment_schema.refunds(order_id);
CREATE INDEX idx_refunds_status ON payment_schema.refunds(status);

COMMENT ON TABLE payment_schema.refunds IS 'Quản lý refund - hỗ trợ partial refund';


-- ============================================================================
-- ============================================================================
--                           AI_SCHEMA
-- ============================================================================
-- Module quản lý: Vector Embeddings cho RAG Chatbot
-- Owner: AI Service (PostgreSQL + pgvector)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: ai_schema.documents
-- Mô tả: Documents đã được index cho RAG
-- ----------------------------------------------------------------------------
CREATE TABLE ai_schema.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Source Information
    source_type VARCHAR(50) NOT NULL,            -- EVENT, FAQ, POLICY, GENERAL
    source_id UUID,                              -- ID của entity gốc (event_id, etc.)
    source_url VARCHAR(500),                     -- URL nguồn nếu có
    
    -- Content
    title VARCHAR(500),
    content TEXT NOT NULL,                       -- Nội dung đã được chunk
    content_hash VARCHAR(64),                    -- SHA256 để check duplicate
    
    -- Chunking Info
    chunk_index INT DEFAULT 0,                   -- Thứ tự chunk nếu document được chia nhỏ
    chunk_size INT,                              -- Số characters trong chunk
    parent_document_id UUID,                     -- Parent nếu là chunk con
    
    -- Metadata
    metadata JSONB DEFAULT '{}',                 -- Additional metadata
    
    -- Vector Embedding (pgvector)
    -- Dimension 1536 cho OpenAI ada-002, 384 cho sentence-transformers
    embedding vector(1536),
    
    -- Status
    is_indexed BOOLEAN DEFAULT FALSE,            -- Đã tạo embedding chưa
    indexed_at TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    
    CONSTRAINT chk_document_source CHECK (source_type IN ('EVENT', 'FAQ', 'POLICY', 'GENERAL', 'TICKET_TYPE'))
);

-- Vector similarity search index (HNSW for better performance)
CREATE INDEX idx_documents_embedding ON ai_schema.documents 
    USING hnsw (embedding vector_cosine_ops);

-- Other indexes
CREATE INDEX idx_documents_source ON ai_schema.documents(source_type, source_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_documents_indexed ON ai_schema.documents(is_indexed) WHERE is_deleted = FALSE;
CREATE INDEX idx_documents_hash ON ai_schema.documents(content_hash);

COMMENT ON TABLE ai_schema.documents IS 'Documents cho RAG - mỗi event/FAQ được chunk và embed';
COMMENT ON COLUMN ai_schema.documents.embedding IS 'Vector embedding 1536-dim cho OpenAI ada-002';

-- ----------------------------------------------------------------------------
-- Table: ai_schema.conversations
-- Mô tả: Lịch sử hội thoại với chatbot
-- ----------------------------------------------------------------------------
CREATE TABLE ai_schema.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User
    user_id VARCHAR(255),                        -- NULL nếu là guest
    session_id VARCHAR(255) NOT NULL,            -- Session ID cho tracking
    
    -- Conversation metadata
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ended_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_conversations_user ON ai_schema.conversations(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_conversations_session ON ai_schema.conversations(session_id);

-- ----------------------------------------------------------------------------
-- Table: ai_schema.messages
-- Mô tả: Các tin nhắn trong conversation
-- ----------------------------------------------------------------------------
CREATE TABLE ai_schema.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Parent Conversation
    conversation_id UUID NOT NULL REFERENCES ai_schema.conversations(id) ON DELETE CASCADE,
    
    -- Message
    role VARCHAR(20) NOT NULL,                   -- USER, ASSISTANT, SYSTEM
    content TEXT NOT NULL,
    
    -- RAG Context (documents used to generate response)
    context_document_ids UUID[],                 -- Array of document IDs used
    
    -- Metadata
    tokens_used INT,                             -- Token count for cost tracking
    model_used VARCHAR(50),                      -- gpt-3.5-turbo, gpt-4, etc.
    response_time_ms INT,                        -- Response latency
    
    -- Feedback
    user_rating INT,                             -- 1-5 rating
    user_feedback TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT chk_message_role CHECK (role IN ('USER', 'ASSISTANT', 'SYSTEM'))
);

CREATE INDEX idx_messages_conversation ON ai_schema.messages(conversation_id);
CREATE INDEX idx_messages_created ON ai_schema.messages(created_at);

COMMENT ON TABLE ai_schema.messages IS 'Chat history - lưu để analysis và improve chatbot';


-- ============================================================================
-- ============================================================================
--                           TRIGGERS & FUNCTIONS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: Update updated_at timestamp
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at column
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_schema || '.' || table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
        AND table_schema IN ('event_schema', 'booking_schema', 'payment_schema', 'ai_schema')
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_updated_at ON %s;
            CREATE TRIGGER update_updated_at 
            BEFORE UPDATE ON %s 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        ', t, t);
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- Function: Generate Order Number
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION booking_schema.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_number := 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                        UPPER(SUBSTRING(NEW.id::text, 1, 8));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_order_number_trigger
BEFORE INSERT ON booking_schema.orders
FOR EACH ROW EXECUTE FUNCTION booking_schema.generate_order_number();

-- ----------------------------------------------------------------------------
-- Function: Generate Ticket Code
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION booking_schema.generate_ticket_code()
RETURNS TRIGGER AS $$
BEGIN
    NEW.ticket_code := 'TKT-' || UPPER(SUBSTRING(NEW.id::text, 1, 8)) || '-' || 
                       UPPER(SUBSTRING(md5(random()::text), 1, 4));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_ticket_code_trigger
BEFORE INSERT ON booking_schema.tickets
FOR EACH ROW EXECUTE FUNCTION booking_schema.generate_ticket_code();

-- ----------------------------------------------------------------------------
-- Function: Generate Transaction Number
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION payment_schema.generate_transaction_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.transaction_number := 'TXN-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
                              UPPER(SUBSTRING(NEW.id::text, 1, 8));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_transaction_number_trigger
BEFORE INSERT ON payment_schema.transactions
FOR EACH ROW EXECUTE FUNCTION payment_schema.generate_transaction_number();


-- ============================================================================
-- ============================================================================
--                           SAMPLE DATA (Development)
-- ============================================================================

-- Sample Categories
INSERT INTO event_schema.categories (name, slug, description, display_order) VALUES
('Concert', 'concert', 'Các buổi biểu diễn âm nhạc, live show', 1),
('Workshop', 'workshop', 'Các khóa học, hội thảo kỹ năng', 2),
('Sport', 'sport', 'Sự kiện thể thao, giải đấu', 3),
('Theater', 'theater', 'Kịch, múa, nghệ thuật biểu diễn', 4),
('Festival', 'festival', 'Lễ hội, carnival', 5),
('Conference', 'conference', 'Hội nghị, summit', 6);

-- Sample Venue
INSERT INTO event_schema.venues (name, slug, address, city, capacity) VALUES
('Nhà hát Lớn Hà Nội', 'nha-hat-lon-ha-noi', '1 Tràng Tiền, Hoàn Kiếm', 'Hà Nội', 600),
('Sân vận động Mỹ Đình', 'svd-my-dinh', 'Lê Đức Thọ, Nam Từ Liêm', 'Hà Nội', 40000),
('Nhà văn hóa Thanh niên', 'nvh-thanh-nien', '4 Phạm Ngọc Thạch, Quận 3', 'TP.HCM', 1200),
('GEM Center', 'gem-center', '8 Nguyễn Bỉnh Khiêm, Quận 1', 'TP.HCM', 2000);


-- ============================================================================
-- END OF SCRIPT
-- ============================================================================

-- Verify schemas created
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name IN ('event_schema', 'booking_schema', 'payment_schema', 'ai_schema');

-- Verify tables per schema
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_schema IN ('event_schema', 'booking_schema', 'payment_schema', 'ai_schema')
ORDER BY table_schema, table_name;
