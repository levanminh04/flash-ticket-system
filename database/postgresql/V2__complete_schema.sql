-- ============================================================================
-- TICKETBOX DATABASE SCHEMA - COMPLETE VERSION
-- ============================================================================
-- Version: 2.0.0
-- Database: PostgreSQL 14+
-- Author: TicketBox Team
-- Last Updated: 2026-02-08
-- 
-- DESIGN PRINCIPLES:
-- 1. Schema Isolation: Each module has its own schema for microservice extraction
-- 2. UUID Primary Keys: For easy sharding and data merging
-- 3. Audit Columns: created_at, updated_at, created_by, updated_by, is_deleted
-- 4. Logical References: Cross-schema references without hard FK constraints
-- 5. Redis Lock Support: Fields synced with Redis for distributed locking
-- 6. pgvector Support: For AI/RAG features
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
CREATE SCHEMA IF NOT EXISTS promotion_schema;
CREATE SCHEMA IF NOT EXISTS ai_schema;

-- Set default search path
SET search_path TO public, event_schema, booking_schema, payment_schema, promotion_schema, ai_schema;


-- ============================================================================
-- ============================================================================
--                           EVENT_SCHEMA
-- ============================================================================
-- Module quản lý: Sự kiện, Loại vé, Địa điểm, Danh mục, Ghế ngồi
-- Owner: Event Module trong Core Service
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: event_schema.categories
-- Mô tả: Danh mục sự kiện (Concert, Workshop, Sport, Theater, etc.)
-- Relationship: N:N với events thông qua event_categories
-- ----------------------------------------------------------------------------
CREATE TABLE event_schema.categories (
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
    
    -- Audit Columns
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE INDEX idx_categories_parent ON event_schema.categories(parent_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_categories_active ON event_schema.categories(is_active) WHERE is_deleted = FALSE;
CREATE INDEX idx_categories_slug ON event_schema.categories(slug);

COMMENT ON TABLE event_schema.categories IS 'Danh mục sự kiện - phân loại theo Concert, Workshop, Sport, etc.';

-- ----------------------------------------------------------------------------
-- Table: event_schema.venues
-- Mô tả: Địa điểm tổ chức sự kiện
-- Relationship: 1:N với venue_sectors
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
    
    -- Geo Location
    latitude DECIMAL(10, 8),                     -- Vĩ độ: 21.02888
    longitude DECIMAL(11, 8),                    -- Kinh độ: 105.85139
    
    -- Capacity & Facilities
    total_capacity INT,                          -- Tổng sức chứa
    facilities JSONB DEFAULT '[]',               -- Tiện ích: ["Wifi", "Parking", "AC"]
    
    -- Media
    image_urls JSONB DEFAULT '[]',               -- Danh sách ảnh địa điểm
    
    -- Contact
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    website_url VARCHAR(500),
    
    -- Status
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit Columns
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE INDEX idx_venues_city ON event_schema.venues(city) WHERE is_deleted = FALSE;
CREATE INDEX idx_venues_active ON event_schema.venues(is_active) WHERE is_deleted = FALSE;
CREATE INDEX idx_venues_slug ON event_schema.venues(slug);

COMMENT ON TABLE event_schema.venues IS 'Địa điểm tổ chức sự kiện';

-- ----------------------------------------------------------------------------
-- Table: event_schema.venue_sectors
-- Mô tả: Khu vực trong venue (Khán đài A, VIP Zone, Khu đứng)
-- Relationship: Belongs to venue, has many venue_seats
-- ----------------------------------------------------------------------------
CREATE TABLE event_schema.venue_sectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id UUID NOT NULL REFERENCES event_schema.venues(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,                  -- "Khán đài A", "VIP Zone"
    code VARCHAR(20),                            -- "A", "VIP", "STANDING"
    description TEXT,
    
    sector_type VARCHAR(50) NOT NULL,            -- SEATED, STANDING, VIP_BOX
    
    -- Capacity
    total_rows INT,                              -- Số hàng (nếu có ghế)
    seats_per_row INT,                           -- Số ghế/hàng
    total_capacity INT NOT NULL,                 -- Tổng sức chứa
    
    -- Position on venue map (for UI rendering)
    position_x DECIMAL(5,2),                     -- Vị trí % từ trái
    position_y DECIMAL(5,2),                     -- Vị trí % từ trên
    width_percent DECIMAL(5,2),                  -- Chiều rộng %
    height_percent DECIMAL(5,2),                 -- Chiều cao %
    color_code VARCHAR(7),                       -- Color cho UI: "#FF5733"
    
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit Columns
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    
    CONSTRAINT chk_sector_type CHECK (sector_type IN ('SEATED', 'STANDING', 'VIP_BOX', 'ACCESSIBLE'))
);

CREATE INDEX idx_venue_sectors_venue ON event_schema.venue_sectors(venue_id) WHERE is_deleted = FALSE;

COMMENT ON TABLE event_schema.venue_sectors IS 'Khu vực trong venue - Khán đài, VIP Zone, Khu đứng';

-- ----------------------------------------------------------------------------
-- Table: event_schema.venue_seats
-- Mô tả: Từng ghế cụ thể trong sector
-- Relationship: Belongs to venue_sector
-- Note: Ghế là master data, inventory theo event nằm ở event_seat_inventory
-- ----------------------------------------------------------------------------
CREATE TABLE event_schema.venue_seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sector_id UUID NOT NULL REFERENCES event_schema.venue_sectors(id) ON DELETE CASCADE,
    
    row_name VARCHAR(10) NOT NULL,               -- "A", "B", "1", "2"
    seat_number VARCHAR(10) NOT NULL,            -- "1", "2", "3"
    seat_label VARCHAR(20),                      -- "A-1", "VIP-01" (computed or custom)
    
    -- Position on seat map (for UI rendering)
    coord_x INT,                                 -- X coordinate trong grid
    coord_y INT,                                 -- Y coordinate trong grid
    
    -- Seat properties
    seat_type VARCHAR(50) DEFAULT 'REGULAR',     -- REGULAR, WHEELCHAIR, COMPANION, PREMIUM
    is_aisle BOOLEAN DEFAULT FALSE,              -- Ghế cạnh lối đi
    has_obstruction BOOLEAN DEFAULT FALSE,       -- Có vật cản tầm nhìn
    
    is_active BOOLEAN DEFAULT TRUE,              -- Có thể bán không
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT chk_seat_type CHECK (seat_type IN ('REGULAR', 'WHEELCHAIR', 'COMPANION', 'PREMIUM', 'RESTRICTED')),
    CONSTRAINT uk_sector_row_seat UNIQUE (sector_id, row_name, seat_number)
);

CREATE INDEX idx_venue_seats_sector ON event_schema.venue_seats(sector_id);

COMMENT ON TABLE event_schema.venue_seats IS 'Master data ghế ngồi trong venue sector';

-- ----------------------------------------------------------------------------
-- Table: event_schema.events
-- Mô tả: Sự kiện chính - bảng core của hệ thống
-- Relationship: N:N với categories, 1:N với ticket_types, event_images
-- ----------------------------------------------------------------------------
CREATE TABLE event_schema.events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic Information
    title VARCHAR(255) NOT NULL,                 -- Tiêu đề: "Rock Storm 2026"
    slug VARCHAR(255) NOT NULL UNIQUE,           -- URL: "rock-storm-2026"
    short_description VARCHAR(500),              -- Mô tả ngắn cho listing
    description TEXT,                            -- Mô tả đầy đủ (có thể HTML/Markdown)
    
    -- Tags for search
    tags JSONB DEFAULT '[]',                     -- Tags: ["rock", "music", "outdoor"]
    
    -- Schedule
    start_datetime TIMESTAMPTZ NOT NULL,         -- Thời gian bắt đầu
    end_datetime TIMESTAMPTZ NOT NULL,           -- Thời gian kết thúc
    timezone VARCHAR(50) DEFAULT 'Asia/Ho_Chi_Minh',
    
    -- Location (FK trong cùng schema)
    venue_id UUID REFERENCES event_schema.venues(id) ON DELETE SET NULL,
    online_event_url VARCHAR(500),               -- URL nếu là event online
    is_online BOOLEAN DEFAULT FALSE,
    
    -- Organizer (LOGICAL REFERENCE - user ở MongoDB)
    organizer_id VARCHAR(255) NOT NULL,          -- UUID của Organizer từ User Service
    organizer_name VARCHAR(255),                 -- Cache tên để tránh query User Service
    organizer_logo_url VARCHAR(500),             -- Cache logo
    
    -- Ticket Configuration
    min_tickets_per_order INT DEFAULT 1,
    max_tickets_per_order INT DEFAULT 10,
    
    -- Sales Window
    sale_start_datetime TIMESTAMPTZ,
    sale_end_datetime TIMESTAMPTZ,
    
    -- Status & Visibility
    status VARCHAR(50) DEFAULT 'DRAFT' NOT NULL,
    visibility VARCHAR(50) DEFAULT 'PUBLIC', -- kiểm soát ai có quyền tìm thấy và nhìn thấy sự kiện trên ứng dụng/website. PUBLIC, PRIVATE, UNLISTED: có thể bán sự kiện nội bộ, pre-sale cho fan cứng
    is_featured BOOLEAN DEFAULT FALSE,
    
    -- Statistics (denormalized for performance)
    total_capacity INT DEFAULT 0,
    tickets_sold INT DEFAULT 0,
    view_count INT DEFAULT 0, -- Số lượt xem
    
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
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT chk_event_dates CHECK (end_datetime > start_datetime),
    CONSTRAINT chk_event_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED', 'SOLD_OUT')),
    CONSTRAINT chk_event_visibility CHECK (visibility IN ('PUBLIC', 'PRIVATE', 'UNLISTED'))
);

CREATE INDEX idx_events_venue ON event_schema.events(venue_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_events_organizer ON event_schema.events(organizer_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_events_status ON event_schema.events(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_events_datetime ON event_schema.events(start_datetime) WHERE is_deleted = FALSE AND status = 'PUBLISHED';
CREATE INDEX idx_events_featured ON event_schema.events(is_featured) WHERE is_deleted = FALSE AND status = 'PUBLISHED';
CREATE INDEX idx_events_slug ON event_schema.events(slug);

-- Full-text search index
CREATE INDEX idx_events_search ON event_schema.events 
    USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(short_description, '')));

COMMENT ON TABLE event_schema.events IS 'Sự kiện chính - core entity của hệ thống bán vé';

-- ----------------------------------------------------------------------------
-- Table: event_schema.event_categories
-- Mô tả: Junction table cho N:N relationship giữa events và categories
-- ----------------------------------------------------------------------------
CREATE TABLE event_schema.event_categories (
    event_id UUID NOT NULL REFERENCES event_schema.events(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES event_schema.categories(id) ON DELETE CASCADE,
    
    is_primary BOOLEAN DEFAULT FALSE,            -- Category chính hiển thị
    display_order INT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (event_id, category_id)
);

CREATE INDEX idx_event_categories_category ON event_schema.event_categories(category_id);

COMMENT ON TABLE event_schema.event_categories IS 'N:N relationship - 1 event có thể thuộc nhiều categories';

-- ----------------------------------------------------------------------------
-- Table: event_schema.event_images
-- Mô tả: Ảnh của event (lưu trên Cloudinary)
-- ----------------------------------------------------------------------------
CREATE TABLE event_schema.event_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES event_schema.events(id) ON DELETE CASCADE,
    
    image_url VARCHAR(500) NOT NULL,             -- Cloudinary URL
    public_id VARCHAR(255),                      -- Cloudinary public_id (for deletion)
    
    image_type VARCHAR(50) NOT NULL,             -- BANNER, POSTER, SEAT_MAP, GALLERY
    alt_text VARCHAR(255),                       -- SEO alt text
    display_order INT DEFAULT 0,
    
    width INT,                                   -- Dimensions
    height INT,
    file_size_bytes BIGINT,
    
    is_primary BOOLEAN DEFAULT FALSE,            -- Ảnh chính
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(255),
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    
    CONSTRAINT chk_image_type CHECK (image_type IN ('BANNER', 'POSTER', 'SEAT_MAP', 'GALLERY', 'THUMBNAIL'))
);

CREATE INDEX idx_event_images_event ON event_schema.event_images(event_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_event_images_type ON event_schema.event_images(event_id, image_type) WHERE is_deleted = FALSE;

COMMENT ON TABLE event_schema.event_images IS 'Ảnh event lưu trên Cloudinary - Banner, Poster, Sơ đồ ghế';

-- ----------------------------------------------------------------------------
-- Table: event_schema.ticket_types
-- Mô tả: Loại vé của mỗi sự kiện (VIP, Regular, Early Bird, etc.)
-- ----------------------------------------------------------------------------
-- ticket_types là "loại vé" chứ không phải "tấm vé"
-- booking_schema.tickets - tấm vé thực
--
--
--
CREATE TABLE event_schema.ticket_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Parent Event
    event_id UUID NOT NULL REFERENCES event_schema.events(id) ON DELETE CASCADE,
    
    -- Sector (optional - for seat-based events) --  khu vực
    sector_id UUID REFERENCES event_schema.venue_sectors(id) ON DELETE SET NULL,
    
    -- Basic Information
    name VARCHAR(100) NOT NULL,                  -- Tên loại vé: "VIP", "Regular"
    description TEXT,                            -- Mô tả quyền lợi
    
    -- Pricing
    price DECIMAL(15, 2) NOT NULL,               -- Giá vé (VND)
    original_price DECIMAL(15, 2),               -- Giá gốc (nếu đang giảm giá)
    currency VARCHAR(3) DEFAULT 'VND',
    
    -- Inventory Management
    quantity_total INT NOT NULL,                 -- Tổng số vé loại này
    quantity_available INT NOT NULL,             -- Số vé còn lại
    quantity_reserved INT DEFAULT 0,             -- Số vé đang giữ chỗ
    max_per_order INT DEFAULT 10,                -- Giới hạn mua mỗi đơn
    
    -- Seat Selection
    seat_selection_enabled BOOLEAN DEFAULT FALSE,-- Có cho chọn ghế không
    
    -- Sales Window
    sale_start_datetime TIMESTAMPTZ,
    sale_end_datetime TIMESTAMPTZ,
    
    -- Display
    display_order INT DEFAULT 0,
    color_code VARCHAR(7),                       -- Màu hiển thị: "#FF5733"
    
    -- Status
    status VARCHAR(50) DEFAULT 'ACTIVE',
    -- Không phải loại vé nào cũng được công khai cho tất cả mọi người trên website. 
    is_visible BOOLEAN DEFAULT TRUE, -- true: hiển thị, false: không hiển thị
    
    -- Audit Columns
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    
    CONSTRAINT chk_ticket_quantity CHECK (quantity_available >= 0 AND quantity_available <= quantity_total),
    CONSTRAINT chk_ticket_price CHECK (price >= 0),
    CONSTRAINT chk_ticket_status CHECK (status IN ('ACTIVE', 'SOLD_OUT', 'HIDDEN'))
);

CREATE INDEX idx_ticket_types_event ON event_schema.ticket_types(event_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_ticket_types_sector ON event_schema.ticket_types(sector_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_ticket_types_available ON event_schema.ticket_types(quantity_available) 
    WHERE is_deleted = FALSE AND status = 'ACTIVE';

COMMENT ON TABLE event_schema.ticket_types IS 'Loại vé - quản lý inventory';

-- ----------------------------------------------------------------------------
-- Table: event_schema.event_seat_inventory
-- Mô tả: Inventory trạng thái ghế cho từng event (REDIS LOCK SYNC)
-- Critical: Syncs with Redis for distributed locking during Flash Sale
-- ----------------------------------------------------------------------------
CREATE TABLE event_schema.event_seat_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Composite key: Event + Seat
    event_id UUID NOT NULL REFERENCES event_schema.events(id) ON DELETE CASCADE,
    seat_id UUID NOT NULL REFERENCES event_schema.venue_seats(id),
    ticket_type_id UUID REFERENCES event_schema.ticket_types(id) ON DELETE SET NULL,
    
    -- ========== REDIS LOCK SYNC FIELDS ==========
    -- Redis key format: "seat_lock:{event_id}:{seat_id}"
    
    status VARCHAR(50) DEFAULT 'AVAILABLE' NOT NULL,
    -- AVAILABLE: Ghế trống, có thể chọn
    -- LOCKED: Đang bị lock (user đang chọn)
    -- RESERVED: Đã giữ chỗ (pending payment)
    -- SOLD: Đã bán
    -- BLOCKED: Admin block (không bán)
    
    -- Lock tracking (backup for Redis)
    locked_by_user_id VARCHAR(255),              -- User đang lock
    locked_by_session_id VARCHAR(255),           -- Session ID (for anonymous)
    locked_at TIMESTAMPTZ,                       -- Thời điểm lock
    lock_expires_at TIMESTAMPTZ,                 -- Lock hết hạn (sync với Redis TTL)
    
    -- Reservation tracking
    reservation_id UUID,                         -- Reference tới reservations
    reserved_at TIMESTAMPTZ,
    reservation_expires_at TIMESTAMPTZ,
    
    -- Sale tracking
    order_id UUID,                               -- Reference tới orders
    ticket_id UUID,                              -- Reference tới tickets
    sold_at TIMESTAMPTZ,
    
    -- Pricing (adjustment per seat)
    price_adjustment DECIMAL(15,2) DEFAULT 0,    -- +/- so với giá ticket_type
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    version INT DEFAULT 1,                       -- Optimistic locking version
    
    CONSTRAINT chk_seat_status CHECK (status IN ('AVAILABLE', 'LOCKED', 'RESERVED', 'SOLD', 'BLOCKED')),
    CONSTRAINT uk_event_seat UNIQUE (event_id, seat_id)
);

-- Performance indexes for seat locking
CREATE INDEX idx_seat_inventory_event ON event_schema.event_seat_inventory(event_id);
CREATE INDEX idx_seat_inventory_status ON event_schema.event_seat_inventory(event_id, status);
CREATE INDEX idx_seat_inventory_locked ON event_schema.event_seat_inventory(lock_expires_at) 
    WHERE status = 'LOCKED';
CREATE INDEX idx_seat_inventory_reserved ON event_schema.event_seat_inventory(reservation_expires_at) 
    WHERE status = 'RESERVED';
CREATE INDEX idx_seat_inventory_user ON event_schema.event_seat_inventory(locked_by_user_id) 
    WHERE status IN ('LOCKED', 'RESERVED');

COMMENT ON TABLE event_schema.event_seat_inventory IS 'Inventory ghế theo event - sync với Redis cho distributed lock';
COMMENT ON COLUMN event_schema.event_seat_inventory.lock_expires_at IS 'Sync với Redis TTL - background job cleanup expired locks';
COMMENT ON COLUMN event_schema.event_seat_inventory.version IS 'Optimistic locking - increment on update to prevent race condition';


-- ============================================================================
-- ============================================================================
--                           PROMOTION_SCHEMA
-- ============================================================================
-- Module quản lý: Khuyến mãi, Voucher, Discount codes
-- Owner: Promotion Module trong Core Service
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: promotion_schema.promotions
-- Mô tả: Chương trình khuyến mãi / Voucher
-- ----------------------------------------------------------------------------
CREATE TABLE promotion_schema.promotions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    code VARCHAR(50) NOT NULL UNIQUE,            -- "SUMMER2026", "FLASH50"
    name VARCHAR(255) NOT NULL,                  -- Tên chiến dịch
    description TEXT,
    
    -- Discount Configuration
    discount_type VARCHAR(20) NOT NULL,          -- PERCENTAGE, FIXED_AMOUNT
    discount_value DECIMAL(15,2) NOT NULL,       -- 10 (%) hoặc 50000 (VND)
    max_discount_amount DECIMAL(15,2),           -- Giảm tối đa (cho PERCENTAGE)
    
    -- Conditions
    min_order_value DECIMAL(15,2) DEFAULT 0,     -- Giá trị đơn tối thiểu
    min_quantity INT DEFAULT 1,                  -- Số vé tối thiểu
    
    -- Scope: Áp dụng cho event/category nào
    applicable_scope VARCHAR(50) DEFAULT 'ALL',  -- ALL, SPECIFIC_EVENTS, SPECIFIC_CATEGORIES
    applicable_event_ids UUID[],                 -- Danh sách event áp dụng
    applicable_category_ids UUID[],              -- Danh sách category áp dụng
    
    -- Usage Limits
    max_total_uses INT,                          -- Tổng lượt dùng
    max_uses_per_user INT DEFAULT 1,             -- Mỗi user dùng tối đa
    current_uses INT DEFAULT 0,                  -- Đã dùng bao nhiêu
    
    -- Validity Period
    start_datetime TIMESTAMPTZ NOT NULL,
    end_datetime TIMESTAMPTZ NOT NULL,
    
    -- Targeting
    target_user_type VARCHAR(50) DEFAULT 'ALL',  -- ALL, NEW_USER, RETURNING_USER
    
    -- Status
    status VARCHAR(50) DEFAULT 'ACTIVE',
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    
    CONSTRAINT chk_discount_type CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
    CONSTRAINT chk_promotion_status CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED')),
    CONSTRAINT chk_promotion_scope CHECK (applicable_scope IN ('ALL', 'SPECIFIC_EVENTS', 'SPECIFIC_CATEGORIES')),
    CONSTRAINT chk_dates CHECK (end_datetime > start_datetime)
);

CREATE INDEX idx_promotions_code ON promotion_schema.promotions(code) WHERE is_deleted = FALSE;
CREATE INDEX idx_promotions_status ON promotion_schema.promotions(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_promotions_dates ON promotion_schema.promotions(start_datetime, end_datetime) 
    WHERE is_deleted = FALSE AND status = 'ACTIVE';

COMMENT ON TABLE promotion_schema.promotions IS 'Chương trình khuyến mãi - voucher codes';

-- ----------------------------------------------------------------------------
-- Table: promotion_schema.promotion_usages
-- Mô tả: Tracking sử dụng voucher
-- ----------------------------------------------------------------------------
CREATE TABLE promotion_schema.promotion_usages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    promotion_id UUID NOT NULL REFERENCES promotion_schema.promotions(id),
    user_id VARCHAR(255) NOT NULL,               -- Reference tới User Service
    order_id UUID NOT NULL,                      -- Reference tới booking_schema.orders
    
    discount_amount DECIMAL(15,2) NOT NULL,      -- Số tiền đã giảm
    
    used_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT uk_user_promotion_order UNIQUE (user_id, promotion_id, order_id)
);

CREATE INDEX idx_promotion_usages_promotion ON promotion_schema.promotion_usages(promotion_id);
CREATE INDEX idx_promotion_usages_user ON promotion_schema.promotion_usages(user_id);
CREATE INDEX idx_promotion_usages_order ON promotion_schema.promotion_usages(order_id);

COMMENT ON TABLE promotion_schema.promotion_usages IS 'Tracking lịch sử sử dụng voucher';


-- ============================================================================
-- ============================================================================
--                           BOOKING_SCHEMA
-- ============================================================================
-- Module quản lý: Đơn hàng, Giỏ hàng, Vé đã xuất, Giữ chỗ
-- Owner: Booking Module trong Core Service
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: booking_schema.carts
-- Mô tả: Giỏ hàng của user
-- ----------------------------------------------------------------------------
CREATE TABLE booking_schema.carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- User (LOGICAL REFERENCE)
    user_id VARCHAR(255) NOT NULL,               -- UUID từ User Service
    session_id VARCHAR(255),                     -- Session cho guest checkout
    
    -- Expiration
    expires_at TIMESTAMPTZ,
    
    -- Status
    status VARCHAR(50) DEFAULT 'ACTIVE',
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT chk_cart_status CHECK (status IN ('ACTIVE', 'CONVERTED', 'EXPIRED', 'ABANDONED'))
);

CREATE INDEX idx_carts_user ON booking_schema.carts(user_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_carts_expires ON booking_schema.carts(expires_at) WHERE status = 'ACTIVE';

COMMENT ON TABLE booking_schema.carts IS 'Giỏ hàng tạm thời - tự động expire';

-- ----------------------------------------------------------------------------
-- Table: booking_schema.cart_items
-- Mô tả: Các item trong giỏ hàng
-- ----------------------------------------------------------------------------
CREATE TABLE booking_schema.cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    cart_id UUID NOT NULL REFERENCES booking_schema.carts(id) ON DELETE CASCADE,
    
    -- Event & Ticket Type (LOGICAL REFERENCE - cross schema)
    event_id UUID NOT NULL,
    ticket_type_id UUID NOT NULL,
    
    -- Denormalized data (cache)
    event_title VARCHAR(255),
    ticket_type_name VARCHAR(100),
    unit_price DECIMAL(15, 2) NOT NULL,
    
    -- Quantity
    quantity INT NOT NULL DEFAULT 1,
    
    added_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT chk_cart_item_quantity CHECK (quantity > 0)
);

CREATE INDEX idx_cart_items_cart ON booking_schema.cart_items(cart_id);

COMMENT ON TABLE booking_schema.cart_items IS 'Items trong giỏ hàng';

-- ----------------------------------------------------------------------------
-- Table: booking_schema.orders
-- Mô tả: Đơn hàng chính
-- ----------------------------------------------------------------------------
CREATE TABLE booking_schema.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    order_number VARCHAR(50) NOT NULL UNIQUE,    -- "ORD-20260205-XXXXX"
    
    -- Customer (LOGICAL REFERENCE)
    user_id VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    customer_name VARCHAR(255),
    
    -- Event (LOGICAL REFERENCE - cross schema)
    event_id UUID NOT NULL,
    event_title VARCHAR(255),
    event_start_datetime TIMESTAMPTZ,
    event_venue_name VARCHAR(255),
    
    -- Pricing
    subtotal DECIMAL(15, 2) NOT NULL,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'VND',
    
    -- Promotion (LOGICAL REFERENCE - cross schema)
    promotion_id UUID,                           -- Reference tới promotion_schema
    promotion_code VARCHAR(50),                  -- Cache code
    
    -- Status & Lifecycle
    status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
    
    -- Payment Tracking
    payment_method VARCHAR(50),
    paid_at TIMESTAMPTZ,
    
    -- Expiration
    expires_at TIMESTAMPTZ,
    
    -- Notes
    customer_note TEXT,
    internal_note TEXT,
    
    -- Source Tracking
    source VARCHAR(50) DEFAULT 'WEB',
    ip_address VARCHAR(45),
    user_agent TEXT,
    
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

CREATE INDEX idx_orders_user ON booking_schema.orders(user_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_orders_event ON booking_schema.orders(event_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_orders_status ON booking_schema.orders(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_orders_number ON booking_schema.orders(order_number);
CREATE INDEX idx_orders_created ON booking_schema.orders(created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_orders_expires ON booking_schema.orders(expires_at) WHERE status = 'PENDING';

COMMENT ON TABLE booking_schema.orders IS 'Đơn hàng chính - core entity của booking module';

-- ----------------------------------------------------------------------------
-- Table: booking_schema.order_items
-- Mô tả: Chi tiết từng loại vé trong đơn hàng
-- ----------------------------------------------------------------------------
CREATE TABLE booking_schema.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    order_id UUID NOT NULL REFERENCES booking_schema.orders(id) ON DELETE CASCADE,
    
    -- Ticket Type (LOGICAL REFERENCE - cross schema)
    ticket_type_id UUID NOT NULL,
    ticket_type_name VARCHAR(100),
    
    -- Sector info (LOGICAL REFERENCE)
    sector_id UUID,
    sector_name VARCHAR(100),
    
    -- Quantity & Pricing
    quantity INT NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    subtotal DECIMAL(15, 2) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT chk_order_item_quantity CHECK (quantity > 0)
);

CREATE INDEX idx_order_items_order ON booking_schema.order_items(order_id);

COMMENT ON TABLE booking_schema.order_items IS 'Chi tiết vé trong đơn hàng';

-- ----------------------------------------------------------------------------
-- Table: booking_schema.order_item_seats
-- Mô tả: Liên kết order_item với specific seats (cho seat selection)
-- ----------------------------------------------------------------------------
CREATE TABLE booking_schema.order_item_seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    order_item_id UUID NOT NULL REFERENCES booking_schema.order_items(id) ON DELETE CASCADE,
    seat_id UUID NOT NULL,                       -- Reference tới event_schema.venue_seats
    
    -- Seat label for display
    seat_label VARCHAR(20),                      -- "A-1", "VIP-01"
    row_name VARCHAR(10),
    seat_number VARCHAR(10),
    
    -- Pricing at booking time
    price DECIMAL(15,2) NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'RESERVED',
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT chk_seat_status CHECK (status IN ('RESERVED', 'CONFIRMED', 'CANCELLED'))
);

CREATE INDEX idx_order_item_seats_order_item ON booking_schema.order_item_seats(order_item_id);
CREATE INDEX idx_order_item_seats_seat ON booking_schema.order_item_seats(seat_id);

COMMENT ON TABLE booking_schema.order_item_seats IS 'Ghế cụ thể trong order item - cho seat selection';

-- ----------------------------------------------------------------------------
-- Table: booking_schema.tickets
-- Mô tả: Vé đã xuất (sau khi thanh toán thành công) - có QR Code
-- ----------------------------------------------------------------------------
CREATE TABLE booking_schema.tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    ticket_code VARCHAR(100) NOT NULL UNIQUE,    -- "TKT-XXXXXXXX-XXXX"
    
    -- Parent Order
    order_id UUID NOT NULL REFERENCES booking_schema.orders(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES booking_schema.order_items(id) ON DELETE SET NULL,
    
    -- Event & Ticket Type (LOGICAL REFERENCE)
    event_id UUID NOT NULL,
    ticket_type_id UUID NOT NULL,
    
    -- Seat info (LOGICAL REFERENCE)
    seat_id UUID,
    seat_label VARCHAR(20),
    
    -- Denormalized for quick access
    event_title VARCHAR(255),
    event_start_datetime TIMESTAMPTZ,
    event_venue_name VARCHAR(255),
    event_venue_address TEXT,
    ticket_type_name VARCHAR(100),
    
    -- Holder Information
    holder_name VARCHAR(255),
    holder_email VARCHAR(255),
    holder_phone VARCHAR(20),
    
    -- Pricing
    price DECIMAL(15, 2) NOT NULL,
    
    -- QR Code
    qr_code_data TEXT,
    qr_code_image_url VARCHAR(500),
    
    -- Check-in Status
    status VARCHAR(50) DEFAULT 'VALID' NOT NULL,
    checked_in_at TIMESTAMPTZ,
    checked_in_by VARCHAR(255),
    check_in_location VARCHAR(255),
    
    -- Transfer
    is_transferable BOOLEAN DEFAULT TRUE,
    transferred_from_ticket_id UUID,
    transferred_at TIMESTAMPTZ,
    
    -- Audit Columns
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    
    CONSTRAINT chk_ticket_status CHECK (status IN ('VALID', 'USED', 'CANCELLED', 'TRANSFERRED'))
);

CREATE INDEX idx_tickets_code ON booking_schema.tickets(ticket_code);
CREATE INDEX idx_tickets_order ON booking_schema.tickets(order_id);
CREATE INDEX idx_tickets_event ON booking_schema.tickets(event_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_tickets_status ON booking_schema.tickets(status) WHERE is_deleted = FALSE;

COMMENT ON TABLE booking_schema.tickets IS 'Vé đã xuất - có QR code để check-in';

-- ----------------------------------------------------------------------------
-- Table: booking_schema.reservations
-- Mô tả: Giữ chỗ tạm thời trong Flash Sale
-- ----------------------------------------------------------------------------
CREATE TABLE booking_schema.reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    user_id VARCHAR(255) NOT NULL,
    session_id VARCHAR(255),
    
    -- What is being reserved
    event_id UUID NOT NULL,
    ticket_type_id UUID NOT NULL,
    quantity INT NOT NULL,
    
    -- Pricing at reservation time
    unit_price DECIMAL(15, 2) NOT NULL,
    
    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Status
    status VARCHAR(50) DEFAULT 'ACTIVE' NOT NULL,
    
    -- Link to order if converted
    order_id UUID REFERENCES booking_schema.orders(id) ON DELETE SET NULL,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    released_at TIMESTAMPTZ,
    
    CONSTRAINT chk_reservation_status CHECK (status IN ('ACTIVE', 'CONVERTED', 'EXPIRED', 'RELEASED')),
    CONSTRAINT chk_reservation_quantity CHECK (quantity > 0)
);

CREATE INDEX idx_reservations_user ON booking_schema.reservations(user_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_reservations_ticket_type ON booking_schema.reservations(ticket_type_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_reservations_expires ON booking_schema.reservations(expires_at) WHERE status = 'ACTIVE';

COMMENT ON TABLE booking_schema.reservations IS 'Giữ chỗ tạm cho Flash Sale - auto-release khi expire';


-- ============================================================================
-- ============================================================================
--                           PAYMENT_SCHEMA
-- ============================================================================
-- Module quản lý: Giao dịch thanh toán, Refund
-- Owner: Payment Module trong Core Service
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: payment_schema.transactions
-- Mô tả: Giao dịch thanh toán
-- ----------------------------------------------------------------------------
CREATE TABLE payment_schema.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    transaction_number VARCHAR(100) NOT NULL UNIQUE,
    
    -- Order Link (LOGICAL REFERENCE - cross schema)
    order_id UUID NOT NULL,
    order_number VARCHAR(50),
    
    -- User
    user_id VARCHAR(255) NOT NULL,
    
    -- Payment Details
    payment_method VARCHAR(50) NOT NULL,         -- VNPAY, MOMO, BANK_TRANSFER
    payment_provider VARCHAR(50),
    
    -- Amount
    amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'VND',
    
    -- Provider Response
    provider_transaction_id VARCHAR(255),
    provider_response_code VARCHAR(50),
    provider_response_message TEXT,
    provider_raw_response JSONB,
    
    -- Bank Info
    bank_code VARCHAR(20),
    card_type VARCHAR(20),
    
    -- Status
    status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
    
    -- Timestamps
    initiated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at TIMESTAMPTZ,
    
    -- Refund tracking
    is_refunded BOOLEAN DEFAULT FALSE,
    refund_amount DECIMAL(15, 2),
    refunded_at TIMESTAMPTZ,
    refund_reason TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    
    CONSTRAINT chk_transaction_status CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED')),
    CONSTRAINT chk_transaction_amount CHECK (amount > 0)
);

CREATE INDEX idx_transactions_order ON payment_schema.transactions(order_id);
CREATE INDEX idx_transactions_user ON payment_schema.transactions(user_id);
CREATE INDEX idx_transactions_status ON payment_schema.transactions(status);
CREATE INDEX idx_transactions_provider ON payment_schema.transactions(provider_transaction_id);

COMMENT ON TABLE payment_schema.transactions IS 'Lịch sử thanh toán - tích hợp VNPay, MoMo';

-- ----------------------------------------------------------------------------
-- Table: payment_schema.refunds
-- Mô tả: Chi tiết hoàn tiền
-- ----------------------------------------------------------------------------
CREATE TABLE payment_schema.refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    original_transaction_id UUID NOT NULL REFERENCES payment_schema.transactions(id),
    order_id UUID NOT NULL,
    
    -- Refund Details
    refund_amount DECIMAL(15, 2) NOT NULL,
    refund_reason TEXT NOT NULL,
    refund_type VARCHAR(50) DEFAULT 'FULL',
    
    -- Requested By
    requested_by VARCHAR(255) NOT NULL,
    requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Processing
    status VARCHAR(50) DEFAULT 'PENDING' NOT NULL,
    processed_by VARCHAR(255),
    processed_at TIMESTAMPTZ,
    
    -- Provider Response
    provider_refund_id VARCHAR(255),
    provider_response JSONB,
    
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
    
    source_type VARCHAR(50) NOT NULL,            -- EVENT, FAQ, POLICY, GENERAL
    source_id UUID,
    source_url VARCHAR(500),
    
    title VARCHAR(500),
    content TEXT NOT NULL,
    content_hash VARCHAR(64),
    
    -- Chunking Info
    chunk_index INT DEFAULT 0,
    chunk_size INT,
    parent_document_id UUID,
    
    metadata JSONB DEFAULT '{}',
    
    -- Vector Embedding (pgvector)
    embedding vector(1536),
    
    is_indexed BOOLEAN DEFAULT FALSE,
    indexed_at TIMESTAMPTZ,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
    
    CONSTRAINT chk_document_source CHECK (source_type IN ('EVENT', 'FAQ', 'POLICY', 'GENERAL', 'TICKET_TYPE'))
);

CREATE INDEX idx_documents_embedding ON ai_schema.documents 
    USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_documents_source ON ai_schema.documents(source_type, source_id) WHERE is_deleted = FALSE;

COMMENT ON TABLE ai_schema.documents IS 'Documents cho RAG - mỗi event/FAQ được chunk và embed';

-- ----------------------------------------------------------------------------
-- Table: ai_schema.conversations
-- Mô tả: Lịch sử hội thoại với chatbot
-- ----------------------------------------------------------------------------
CREATE TABLE ai_schema.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    user_id VARCHAR(255),
    session_id VARCHAR(255) NOT NULL,
    
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ended_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    
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
    
    conversation_id UUID NOT NULL REFERENCES ai_schema.conversations(id) ON DELETE CASCADE,
    
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    
    context_document_ids UUID[],
    
    tokens_used INT,
    model_used VARCHAR(50),
    response_time_ms INT,
    
    user_rating INT,
    user_feedback TEXT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    CONSTRAINT chk_message_role CHECK (role IN ('USER', 'ASSISTANT', 'SYSTEM'))
);

CREATE INDEX idx_messages_conversation ON ai_schema.messages(conversation_id);

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
        AND table_schema IN ('event_schema', 'booking_schema', 'payment_schema', 'promotion_schema', 'ai_schema')
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

-- ----------------------------------------------------------------------------
-- Function: Increment promotion usage count
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION promotion_schema.increment_promotion_usage()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE promotion_schema.promotions 
    SET current_uses = current_uses + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.promotion_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_promotion_usage_trigger
AFTER INSERT ON promotion_schema.promotion_usages
FOR EACH ROW EXECUTE FUNCTION promotion_schema.increment_promotion_usage();


-- ============================================================================
-- ============================================================================
--                           SAMPLE DATA (Development)
-- ============================================================================

-- Sample Categories
INSERT INTO event_schema.categories (name, slug, description, display_order) VALUES
('Âm nhạc', 'am-nhac', 'Các buổi biểu diễn âm nhạc, live show, concert', 1),
('Sân khấu & Nghệ thuật', 'san-khau-nghe-thuat', 'Kịch, múa, nghệ thuật biểu diễn', 2),
('Thể thao', 'the-thao', 'Sự kiện thể thao, giải đấu', 3),
('Workshop', 'workshop', 'Các khóa học, hội thảo kỹ năng', 4),
('Hội nghị', 'hoi-nghi', 'Hội nghị, summit, conference', 5),
('Lễ hội', 'le-hoi', 'Lễ hội, carnival, festival', 6),
('Khác', 'khac', 'Các sự kiện khác', 99);

-- Sub-categories
INSERT INTO event_schema.categories (name, slug, description, display_order, parent_id) 
SELECT 'Nhạc trẻ', 'nhac-tre', 'Nhạc Việt đương đại', 1, id FROM event_schema.categories WHERE slug = 'am-nhac';

INSERT INTO event_schema.categories (name, slug, description, display_order, parent_id) 
SELECT 'Rock', 'rock', 'Nhạc Rock', 2, id FROM event_schema.categories WHERE slug = 'am-nhac';

INSERT INTO event_schema.categories (name, slug, description, display_order, parent_id) 
SELECT 'EDM', 'edm', 'Electronic Dance Music', 3, id FROM event_schema.categories WHERE slug = 'am-nhac';

-- Sample Venues
INSERT INTO event_schema.venues (name, slug, address, city, total_capacity) VALUES
('Nhà hát Lớn Hà Nội', 'nha-hat-lon-ha-noi', '1 Tràng Tiền, Hoàn Kiếm', 'Hà Nội', 600),
('Sân vận động Mỹ Đình', 'svd-my-dinh', 'Lê Đức Thọ, Nam Từ Liêm', 'Hà Nội', 40000),
('Nhà văn hóa Thanh niên', 'nvh-thanh-nien', '4 Phạm Ngọc Thạch, Quận 3', 'TP.HCM', 1200),
('GEM Center', 'gem-center', '8 Nguyễn Bỉnh Khiêm, Quận 1', 'TP.HCM', 2000),
('Phố đi bộ Nguyễn Huệ', 'pho-di-bo-nguyen-hue', 'Nguyễn Huệ, Quận 1', 'TP.HCM', 10000);

-- Sample Sectors for "Sân vận động Mỹ Đình"
INSERT INTO event_schema.venue_sectors (venue_id, name, code, sector_type, total_capacity, display_order, color_code)
SELECT id, 'Khán đài A', 'A', 'SEATED', 5000, 1, '#FF6B6B'
FROM event_schema.venues WHERE slug = 'svd-my-dinh';

INSERT INTO event_schema.venue_sectors (venue_id, name, code, sector_type, total_capacity, display_order, color_code)
SELECT id, 'Khán đài B', 'B', 'SEATED', 5000, 2, '#4ECDC4'
FROM event_schema.venues WHERE slug = 'svd-my-dinh';

INSERT INTO event_schema.venue_sectors (venue_id, name, code, sector_type, total_capacity, display_order, color_code)
SELECT id, 'VIP Zone', 'VIP', 'VIP_BOX', 500, 3, '#FFE66D'
FROM event_schema.venues WHERE slug = 'svd-my-dinh';

INSERT INTO event_schema.venue_sectors (venue_id, name, code, sector_type, total_capacity, display_order, color_code)
SELECT id, 'Khu đứng - Sân A', 'STANDING-A', 'STANDING', 10000, 4, '#95E1D3'
FROM event_schema.venues WHERE slug = 'svd-my-dinh';

-- Sample Promotion
INSERT INTO promotion_schema.promotions (code, name, description, discount_type, discount_value, max_discount_amount, min_order_value, max_total_uses, max_uses_per_user, start_datetime, end_datetime, status)
VALUES 
('WELCOME2026', 'Chào mừng 2026', 'Giảm 10% cho đơn hàng đầu tiên', 'PERCENTAGE', 10, 100000, 200000, 1000, 1, '2026-01-01 00:00:00+07', '2026-12-31 23:59:59+07', 'ACTIVE'),
('FLASH50K', 'Flash Sale 50K', 'Giảm ngay 50.000đ', 'FIXED_AMOUNT', 50000, NULL, 300000, 500, 1, '2026-02-01 00:00:00+07', '2026-02-28 23:59:59+07', 'ACTIVE');


-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify schemas created
SELECT schema_name FROM information_schema.schemata 
WHERE schema_name IN ('event_schema', 'booking_schema', 'payment_schema', 'promotion_schema', 'ai_schema');

-- Verify tables per schema
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_schema IN ('event_schema', 'booking_schema', 'payment_schema', 'promotion_schema', 'ai_schema')
ORDER BY table_schema, table_name;

-- Count tables
SELECT table_schema, COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema IN ('event_schema', 'booking_schema', 'payment_schema', 'promotion_schema', 'ai_schema')
GROUP BY table_schema;


-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
-- Total Tables: 24
-- - event_schema: 8 tables (categories, venues, venue_sectors, venue_seats, events, event_categories, event_images, ticket_types, event_seat_inventory)
-- - promotion_schema: 2 tables (promotions, promotion_usages)
-- - booking_schema: 7 tables (carts, cart_items, orders, order_items, order_item_seats, tickets, reservations)
-- - payment_schema: 2 tables (transactions, refunds)
-- - ai_schema: 3 tables (documents, conversations, messages)
-- ============================================================================
