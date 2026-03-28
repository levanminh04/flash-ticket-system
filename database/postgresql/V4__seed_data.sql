-- ============================================================================
-- SEED DATA - Flash Ticket System
-- Version: V4__seed_data.sql
-- Purpose: Test data for Event Discovery APIs
--
-- ✅ TRANSACTIONAL: BEGIN → INSERT → COMMIT
--    Nếu bất kỳ lệnh nào lỗi, PostgreSQL sẽ ROLLBACK toàn bộ transaction
--
-- ✅ CLEAN SLATE: TRUNCATE CASCADE xóa sạch toàn bộ event_schema tables trước
--    → Không bao giờ bị duplicate key, bất kể DB đang ở trạng thái gì
--
-- ✅ CONSTRAINT-AWARE: Insert theo đúng thứ tự FK dependency:
--    categories(root) → categories(sub) → venues → events → event_categories
--    → event_images → ticket_types
--
-- SCHEMA AUDIT (V2__complete_schema.sql):
--   categories.slug             UNIQUE
--   categories.parent_id        FK → categories.id (self-referencing)
--   venues.slug                 UNIQUE
--   events.slug                 UNIQUE
--   events.venue_id             FK → venues.id ON DELETE SET NULL
--   events.status               CHECK IN ('DRAFT','PUBLISHED','CANCELLED','COMPLETED','SOLD_OUT')
--   events.visibility           CHECK IN ('PUBLIC','PRIVATE','UNLISTED')
--   events.end_datetime         CHECK > start_datetime
--   event_categories            PK (event_id, category_id)
--   event_categories.event_id   FK → events.id ON DELETE CASCADE
--   event_categories.category_id FK → categories.id ON DELETE CASCADE
--   event_images.event_id       FK → events.id ON DELETE CASCADE
--   event_images.image_type     CHECK IN ('BANNER','POSTER','SEAT_MAP','GALLERY','THUMBNAIL')
--   ticket_types.event_id       FK → events.id ON DELETE CASCADE
--   ticket_types.event_sector_id FK → event_sectors.id ON DELETE SET NULL (nullable)
--   ticket_types.status         CHECK IN ('ACTIVE', 'SOLD_OUT', 'HIDDEN')
--   ticket_types.quantity       CHECK quantity_available >= 0 AND <= quantity_total
--   ticket_types.price          CHECK >= 0
--
-- TEST CASES COVERED:
--   ✅ GET /api/events?search=rock     | Full-text search
--   ✅ GET /api/events?city=Hà Nội     | City filter via venue join
--   ✅ GET /api/events?category=am-nhac | Category filter via junction table
--   ✅ GET /api/events?minPrice=1000000 | Price range filter
--   ✅ GET /api/events/featured         | is_featured = TRUE  (3 events)
--   ✅ GET /api/events/rock-storm-2026  | Lookup by slug
--   ✅ GET /api/events/{uuid}           | Lookup by UUID
--   ✅ DRAFT event NOT in results       | status='DRAFT' filtered out
--   ✅ SOLD_OUT event shown             | status='SOLD_OUT', qty=0
--   ✅ Online event (no venue)          | is_online=true, venue_id=NULL
--   ✅ Multiple ticket types per event  | 1–3 types per event
--   ✅ Multiple categories per event    | primary + sub-category
--   ✅ Multiple images per event        | banner, poster, gallery, seat_map
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 0: CLEAN SLATE
-- TRUNCATE CASCADE xóa sạch tất cả data + dependent tables
-- Thứ tự không quan trọng vì CASCADE tự xử lý FK dependency
-- ============================================================================
TRUNCATE TABLE event_schema.event_seat_inventory CASCADE;
TRUNCATE TABLE event_schema.ticket_types CASCADE;
TRUNCATE TABLE event_schema.event_images CASCADE;
TRUNCATE TABLE event_schema.event_categories CASCADE;
TRUNCATE TABLE event_schema.events CASCADE;
TRUNCATE TABLE event_schema.venues CASCADE;
TRUNCATE TABLE event_schema.categories CASCADE;


-- ============================================================================
-- STEP 1: CATEGORIES
-- Self-referencing FK → insert root trước (parent_id=NULL), sub sau
-- ============================================================================

-- Root categories
INSERT INTO event_schema.categories
    (id, name, slug, description, icon_url, display_order, is_active, is_deleted, created_at, updated_at)
VALUES
    ('11111111-0000-0000-0000-000000000001', 'Âm nhạc',    'am-nhac',    'Các sự kiện âm nhạc, concert, live show',    'https://cdn.ticketbox.vn/icons/music.svg',    1, TRUE, FALSE, NOW(), NOW()),
    ('11111111-0000-0000-0000-000000000002', 'Thể thao',   'the-thao',   'Giải đấu thể thao, marathon, esports',       'https://cdn.ticketbox.vn/icons/sport.svg',    2, TRUE, FALSE, NOW(), NOW()),
    ('11111111-0000-0000-0000-000000000003', 'Hội thảo',   'hoi-thao',   'Workshop, seminar, conference',              'https://cdn.ticketbox.vn/icons/workshop.svg', 3, TRUE, FALSE, NOW(), NOW()),
    ('11111111-0000-0000-0000-000000000004', 'Nghệ thuật', 'nghe-thuat', 'Triển lãm, sân khấu, múa, kịch',            'https://cdn.ticketbox.vn/icons/art.svg',      4, TRUE, FALSE, NOW(), NOW()),
    ('11111111-0000-0000-0000-000000000005', 'Ẩm thực',    'am-thuc',    'Food festival, lễ hội ẩm thực',             'https://cdn.ticketbox.vn/icons/food.svg',     5, TRUE, FALSE, NOW(), NOW());

-- Sub-categories (parent đã tồn tại ở trên)
INSERT INTO event_schema.categories
    (id, name, slug, description, icon_url, display_order, parent_id, is_active, is_deleted, created_at, updated_at)
VALUES
    ('11111111-0000-0000-0000-000000000011', 'Rock',    'rock',    'Nhạc rock, metal, alternative',     NULL, 1, '11111111-0000-0000-0000-000000000001', TRUE, FALSE, NOW(), NOW()),
    ('11111111-0000-0000-0000-000000000012', 'EDM',     'edm',     'Electronic dance music, DJ set',    NULL, 2, '11111111-0000-0000-0000-000000000001', TRUE, FALSE, NOW(), NOW()),
    ('11111111-0000-0000-0000-000000000013', 'Esports', 'esports', 'Giải đấu game, gaming tournament', NULL, 1, '11111111-0000-0000-0000-000000000002', TRUE, FALSE, NOW(), NOW());


-- ============================================================================
-- STEP 2: VENUES
-- ============================================================================
INSERT INTO event_schema.venues (
    id, name, slug, description,
    address, ward, district, city, country, postal_code,
    latitude, longitude,
    total_capacity, facilities, image_urls,
    contact_phone, contact_email, website_url,
    is_verified, is_active, is_deleted, created_at, updated_at
)
VALUES
    (
        '22222222-0000-0000-0000-000000000001',
        'Sân vận động Quốc gia Mỹ Đình', 'san-van-dong-my-dinh',
        'Sân vận động quốc gia lớn nhất Việt Nam, sức chứa 40,000 khán giả',
        'Đường Lê Đức Thọ, Mỹ Đình', 'Mỹ Đình', 'Nam Từ Liêm', 'Hà Nội', 'Vietnam', '100000',
        21.02288000, 105.76539000, 40000,
        '["Bãi đỗ xe lớn", "Nhà vệ sinh", "Khu ẩm thực", "Màn hình LED", "Âm thanh chuyên nghiệp"]',
        '["https://cdn.ticketbox.vn/venues/my-dinh-1.jpg", "https://cdn.ticketbox.vn/venues/my-dinh-2.jpg"]',
        '024-3835-1234', 'contact@mydinhstadium.vn', 'https://mydinhstadium.vn',
        TRUE, TRUE, FALSE, NOW(), NOW()
    ),
    (
        '22222222-0000-0000-0000-000000000002',
        'Cung Văn hóa Hữu nghị Hà Nội', 'cung-van-hoa-huu-nghi-ha-noi',
        'Trung tâm văn hóa nghệ thuật lớn tại Hà Nội',
        '91 Trần Hưng Đạo', 'Trần Hưng Đạo', 'Hoàn Kiếm', 'Hà Nội', 'Vietnam', '100000',
        21.02888000, 105.84500000, 3000,
        '["Điều hòa", "Wifi", "Nhà hàng", "Bãi đỗ xe"]',
        '["https://cdn.ticketbox.vn/venues/cung-huu-nghi-1.jpg"]',
        '024-3942-3456', 'info@huunghihn.vn', NULL,
        TRUE, TRUE, FALSE, NOW(), NOW()
    ),
    (
        '22222222-0000-0000-0000-000000000003',
        'GEM Center', 'gem-center-hcm',
        'Trung tâm sự kiện và hội nghị đẳng cấp tại TP.HCM',
        '8 Nguyễn Bỉnh Khiêm, Đa Kao', 'Đa Kao', 'Quận 1', 'TP.HCM', 'Vietnam', '700000',
        10.78800000, 106.70200000, 3500,
        '["Điều hòa", "Wifi tốc độ cao", "Bãi đỗ xe", "Nhà hàng", "Phòng VIP"]',
        '["https://cdn.ticketbox.vn/venues/gem-center-1.jpg", "https://cdn.ticketbox.vn/venues/gem-center-2.jpg"]',
        '028-3820-3456', 'booking@gemcenter.vn', 'https://gemcenter.vn',
        TRUE, TRUE, FALSE, NOW(), NOW()
    ),
    (
        '22222222-0000-0000-0000-000000000004',
        'Công viên bờ sông Sài Gòn', 'cong-vien-bo-song-sai-gon',
        'Không gian ngoài trời rộng lớn bên bờ sông Sài Gòn',
        'Đường Tôn Đức Thắng, Bến Nghé', 'Bến Nghé', 'Quận 1', 'TP.HCM', 'Vietnam', '700000',
        10.77200000, 106.70500000, 15000,
        '["Không gian ngoài trời", "View sông đẹp", "Khu ẩm thực"]',
        '["https://cdn.ticketbox.vn/venues/saigon-river-1.jpg"]',
        NULL, NULL, NULL,
        FALSE, TRUE, FALSE, NOW(), NOW()
    ),
    (
        '22222222-0000-0000-0000-000000000005',
        'Old Trafford', 'old-trafford',
        'Sân nhà của Manchester United, một trong những sân vận động nổi tiếng nhất thế giới với sức chứa hơn 74,000 khán giả',
        'Sir Matt Busby Way', 'Trafford', 'Greater Manchester', 'Manchester', 'United Kingdom', 'M16 0RA',
        53.46310000, -2.29130000, 74310,
        '["Bãi đỗ xe", "Nhà vệ sinh", "Khu ẩm thực", "Cửa hàng lưu niệm", "Bảo tàng CLB", "Wifi miễn phí"]',
        '["https://cdn.ticketbox.vn/venues/old-trafford-1.jpg", "https://cdn.ticketbox.vn/venues/old-trafford-2.jpg"]',
        '+44-161-868-8000', 'enquiries@manutd.co.uk', 'https://www.manutd.com',
        TRUE, TRUE, FALSE, NOW(), NOW()
    );


-- ============================================================================
-- STEP 3: EVENTS
-- FK: venue_id → venues.id
-- CHECK: end_datetime > start_datetime
-- CHECK: status IN ('DRAFT','PUBLISHED','CANCELLED','COMPLETED','SOLD_OUT')
-- CHECK: visibility IN ('PUBLIC','PRIVATE','UNLISTED')
-- ============================================================================
INSERT INTO event_schema.events (
    id, title, slug, short_description, description, tags,
    start_datetime, end_datetime, timezone,
    venue_id, online_event_url, is_online,
    organizer_id, organizer_name, organizer_logo_url,
    min_tickets_per_order, max_tickets_per_order,
    sale_start_datetime, sale_end_datetime,
    status, visibility, is_featured,
    total_capacity, tickets_sold, view_count,
    min_price, banner_url,
    meta_title, meta_description,
    is_deleted, created_at, updated_at
)
VALUES
    -- EVENT 1: Rock Concert — PUBLISHED, FEATURED, Hà Nội (venue 1)
    (
        'aaaaaaaa-0000-0000-0000-000000000001',
        'Rock Storm 2026 - Đêm Nhạc Rock Huyền Thoại', 'rock-storm-2026',
        'Đêm nhạc rock hoành tráng với sự tham gia của các ban nhạc hàng đầu Việt Nam',
        '<h2>Rock Storm 2026</h2><p>Quy tụ Bức Tường, Microwave, Da LAB.</p><h3>Line-up</h3><ul><li>Bức Tường - 19:00</li><li>Microwave - 20:30</li><li>Da LAB - 22:00</li></ul>',
        '["rock", "concert", "live-music", "buc-tuong", "da-lab", "ha-noi"]',
        '2026-03-15 19:00:00+07', '2026-03-15 23:30:00+07', 'Asia/Ho_Chi_Minh',
        '22222222-0000-0000-0000-000000000001', NULL, FALSE,
        'org-001', 'Live Nation Vietnam', 'https://cdn.ticketbox.vn/organizers/live-nation.png',
        1, 8, '2026-02-01 00:00:00+07', '2026-03-15 17:00:00+07',
        'PUBLISHED', 'PUBLIC', TRUE,
        40000, 12500, 85420,
        500000, 'https://cdn.ticketbox.vn/events/rock-storm-2026/banner.jpg',
        'Rock Storm 2026 - Đêm Nhạc Rock Huyền Thoại tại Mỹ Đình',
        'Concert rock lớn nhất năm với Bức Tường, Microwave, Da LAB tại SVĐ Mỹ Đình Hà Nội',
        FALSE, NOW(), NOW()
    ),

    -- EVENT 2: EDM Festival — PUBLISHED, FEATURED, TP.HCM (venue 4)
    (
        'aaaaaaaa-0000-0000-0000-000000000002',
        'Ultra Vietnam 2026 - EDM Festival', 'ultra-vietnam-2026',
        'Lễ hội âm nhạc điện tử lớn nhất Đông Nam Á đổ bộ Việt Nam',
        '<h2>Ultra Vietnam 2026</h2><p>Martin Garrix, Tiësto, David Guetta. 2 ngày 2 đêm bờ sông Sài Gòn.</p>',
        '["edm", "festival", "dj", "martin-garrix", "tiesto", "ho-chi-minh"]',
        '2026-04-18 16:00:00+07', '2026-04-19 02:00:00+07', 'Asia/Ho_Chi_Minh',
        '22222222-0000-0000-0000-000000000004', NULL, FALSE,
        'org-002', 'Ultra Worldwide Vietnam', 'https://cdn.ticketbox.vn/organizers/ultra.png',
        1, 4, '2026-02-15 00:00:00+07', '2026-04-18 14:00:00+07',
        'PUBLISHED', 'PUBLIC', TRUE,
        15000, 9800, 124500,
        1200000, 'https://cdn.ticketbox.vn/events/ultra-vietnam-2026/banner.jpg',
        'Ultra Vietnam 2026 - EDM Festival tại TP.HCM',
        'Lễ hội EDM lớn nhất với Martin Garrix, Tiësto tại Sài Gòn',
        FALSE, NOW(), NOW()
    ),

    -- EVENT 3: Tech Workshop — PUBLISHED, NOT FEATURED, Hà Nội (venue 2)
    (
        'aaaaaaaa-0000-0000-0000-000000000003',
        'Spring Boot Microservices Workshop 2026', 'spring-boot-microservices-workshop-2026',
        'Workshop thực hành xây dựng hệ thống microservices với Spring Boot, Docker và Kubernetes',
        '<h2>Spring Boot Workshop</h2><p>Khóa học 1 ngày cho Java developers.</p><ul><li>Spring Boot 3.x</li><li>Docker Compose</li><li>Kubernetes cơ bản</li></ul>',
        '["spring-boot", "microservices", "java", "docker", "kubernetes", "workshop"]',
        '2026-03-22 08:30:00+07', '2026-03-22 17:30:00+07', 'Asia/Ho_Chi_Minh',
        '22222222-0000-0000-0000-000000000002', NULL, FALSE,
        'org-003', 'Tech Edu Vietnam', 'https://cdn.ticketbox.vn/organizers/tech-edu.png',
        1, 2, '2026-02-10 00:00:00+07', '2026-03-21 23:59:00+07',
        'PUBLISHED', 'PUBLIC', FALSE,
        200, 180, 3200,
        599000, 'https://cdn.ticketbox.vn/events/spring-boot-workshop/banner.jpg',
        'Spring Boot Microservices Workshop 2026 - Hà Nội',
        'Workshop microservices với Spring Boot, Docker, Kubernetes tại Hà Nội',
        FALSE, NOW(), NOW()
    ),

    -- EVENT 4: Online Event — PUBLISHED, NOT FEATURED, no venue
    (
        'aaaaaaaa-0000-0000-0000-000000000004',
        'Vietnam AI Summit 2026 - Online Conference', 'vietnam-ai-summit-2026',
        'Hội nghị trực tuyến về AI và Machine Learning với các chuyên gia hàng đầu',
        '<h2>Vietnam AI Summit 2026</h2><p>50+ diễn giả từ Google, Microsoft, VinAI.</p>',
        '["ai", "machine-learning", "deep-learning", "online", "conference"]',
        '2026-05-10 09:00:00+07', '2026-05-10 18:00:00+07', 'Asia/Ho_Chi_Minh',
        NULL, 'https://summit.vietnamai.vn/live', TRUE,
        'org-003', 'Tech Edu Vietnam', 'https://cdn.ticketbox.vn/organizers/tech-edu.png',
        1, 1, '2026-03-01 00:00:00+07', '2026-05-10 08:00:00+07',
        'PUBLISHED', 'PUBLIC', FALSE,
        5000, 2100, 18700,
        299000, 'https://cdn.ticketbox.vn/events/vietnam-ai-summit/banner.jpg',
        'Vietnam AI Summit 2026 - Hội nghị AI trực tuyến',
        'Hội nghị AI online với 50+ chuyên gia từ Google, Microsoft, VinAI',
        FALSE, NOW(), NOW()
    ),

    -- EVENT 5: SOLD_OUT — FEATURED, TP.HCM (venue 3)
    (
        'aaaaaaaa-0000-0000-0000-000000000005',
        'Sơn Tùng M-TP Sky Tour 2026', 'son-tung-mtp-sky-tour-2026',
        'Đêm nhạc solo của Sơn Tùng M-TP - Tour diễn lớn nhất sự nghiệp',
        '<h2>Sky Tour 2026</h2><p>Sân khấu 360 độ, công nghệ hologram, bản hit không thể quên.</p>',
        '["son-tung", "vpop", "concert", "ho-chi-minh", "sold-out"]',
        '2026-03-28 19:30:00+07', '2026-03-28 22:30:00+07', 'Asia/Ho_Chi_Minh',
        '22222222-0000-0000-0000-000000000003', NULL, FALSE,
        'org-004', 'M-TP Entertainment', 'https://cdn.ticketbox.vn/organizers/mtp.png',
        1, 6, '2026-01-15 00:00:00+07', '2026-03-28 17:00:00+07',
        'SOLD_OUT', 'PUBLIC', TRUE,
        3500, 3500, 256000,
        800000, 'https://cdn.ticketbox.vn/events/son-tung-sky-tour/banner.jpg',
        'Sơn Tùng M-TP Sky Tour 2026 - GEM Center TP.HCM',
        'Sky Tour 2026 tại GEM Center TP.HCM',
        FALSE, NOW(), NOW()
    ),

    -- EVENT 6: DRAFT — không hiện trong search
    (
        'aaaaaaaa-0000-0000-0000-000000000006',
        'Food Festival Hà Nội 2026', 'food-festival-ha-noi-2026',
        'Lễ hội ẩm thực đường phố lớn nhất Hà Nội',
        '<p>Hơn 200 gian hàng từ khắp các tỉnh thành.</p>',
        '["food", "festival", "am-thuc", "ha-noi"]',
        '2026-06-20 10:00:00+07', '2026-06-22 22:00:00+07', 'Asia/Ho_Chi_Minh',
        '22222222-0000-0000-0000-000000000001', NULL, FALSE,
        'org-005', 'Hanoi Events', 'https://cdn.ticketbox.vn/organizers/hanoi-events.png',
        1, 10, '2026-05-01 00:00:00+07', '2026-06-20 08:00:00+07',
        'DRAFT', 'PUBLIC', FALSE,
        20000, 0, 0,
        NULL, NULL, NULL, NULL,
        FALSE, NOW(), NOW()
    );


-- ============================================================================
-- STEP 4: EVENT_CATEGORIES
-- PK: (event_id, category_id)
-- FK: event_id → events.id | category_id → categories.id
-- ============================================================================
INSERT INTO event_schema.event_categories (event_id, category_id, is_primary, display_order, created_at)
VALUES
    ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', TRUE,  1, NOW()),
    ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000011', FALSE, 2, NOW()),
    ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', TRUE,  1, NOW()),
    ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000012', FALSE, 2, NOW()),
    ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003', TRUE,  1, NOW()),
    ('aaaaaaaa-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000003', TRUE,  1, NOW()),
    ('aaaaaaaa-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000001', TRUE,  1, NOW()),
    ('aaaaaaaa-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000005', TRUE,  1, NOW());


-- ============================================================================
-- STEP 5: EVENT_IMAGES
-- FK: event_id → events.id
-- CHECK: image_type IN ('BANNER','POSTER','SEAT_MAP','GALLERY','THUMBNAIL')
-- ============================================================================
INSERT INTO event_schema.event_images
    (id, event_id, image_url, public_id, image_type, alt_text, display_order, width, height, is_primary, is_deleted, created_at)
VALUES
    ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'https://cdn.ticketbox.vn/events/rock-storm-2026/banner.jpg',    'events/rock-storm-2026/banner',    'BANNER',  'Rock Storm 2026 Banner',    0, 1920, 1080, TRUE,  FALSE, NOW()),
    ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'https://cdn.ticketbox.vn/events/rock-storm-2026/poster.jpg',    'events/rock-storm-2026/poster',    'POSTER',  'Rock Storm 2026 Poster',    1, 800,  1200, FALSE, FALSE, NOW()),
    ('cccccccc-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'https://cdn.ticketbox.vn/events/rock-storm-2026/gallery-1.jpg', 'events/rock-storm-2026/gallery-1', 'GALLERY', 'Rock Storm Gallery 1',      2, 1200, 800,  FALSE, FALSE, NOW()),
    ('cccccccc-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'https://cdn.ticketbox.vn/events/rock-storm-2026/gallery-2.jpg', 'events/rock-storm-2026/gallery-2', 'GALLERY', 'Rock Storm Gallery 2',      3, 1200, 800,  FALSE, FALSE, NOW()),
    ('cccccccc-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000002', 'https://cdn.ticketbox.vn/events/ultra-vietnam-2026/banner.jpg', 'events/ultra-vietnam-2026/banner', 'BANNER',  'Ultra Vietnam 2026 Banner', 0, 1920, 1080, TRUE,  FALSE, NOW()),
    ('cccccccc-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000002', 'https://cdn.ticketbox.vn/events/ultra-vietnam-2026/poster.jpg', 'events/ultra-vietnam-2026/poster', 'POSTER',  'Ultra Vietnam 2026 Poster', 1, 800,  1200, FALSE, FALSE, NOW()),
    ('cccccccc-0000-0000-0000-000000000021', 'aaaaaaaa-0000-0000-0000-000000000003', 'https://cdn.ticketbox.vn/events/spring-boot-workshop/banner.jpg', 'events/spring-boot-workshop/banner', 'BANNER', 'Workshop Banner',        0, 1920, 1080, TRUE,  FALSE, NOW()),
    ('cccccccc-0000-0000-0000-000000000031', 'aaaaaaaa-0000-0000-0000-000000000004', 'https://cdn.ticketbox.vn/events/vietnam-ai-summit/banner.jpg',  'events/vietnam-ai-summit/banner',  'BANNER',  'AI Summit Banner',          0, 1920, 1080, TRUE,  FALSE, NOW()),
    ('cccccccc-0000-0000-0000-000000000041', 'aaaaaaaa-0000-0000-0000-000000000005', 'https://cdn.ticketbox.vn/events/son-tung-sky-tour/banner.jpg',   'events/son-tung-sky-tour/banner',   'BANNER',   'Sky Tour Banner',        0, 1920, 1080, TRUE,  FALSE, NOW()),
    ('cccccccc-0000-0000-0000-000000000042', 'aaaaaaaa-0000-0000-0000-000000000005', 'https://cdn.ticketbox.vn/events/son-tung-sky-tour/seat-map.jpg', 'events/son-tung-sky-tour/seat-map', 'SEAT_MAP', 'GEM Center Seat Map',    1, 1200, 900,  FALSE, FALSE, NOW());


-- ============================================================================
-- STEP 6: TICKET TYPES
-- FK: event_id → events.id | event_sector_id → event_sectors.id (NULL OK)
-- CHECK: status IN ('ACTIVE', 'SOLD_OUT', 'HIDDEN')
-- CHECK: quantity_available >= 0 AND quantity_available <= quantity_total
-- CHECK: price >= 0
-- ============================================================================
INSERT INTO event_schema.ticket_types (
    id, event_id, name, description,
    price, original_price, currency,
    quantity_total, quantity_available, quantity_reserved, max_per_order,
    seat_selection_enabled,
    sale_start_datetime, sale_end_datetime,
    display_order, color_code, status, is_visible,
    is_deleted, created_at, updated_at
)
VALUES
    -- Rock Storm: 3 loại vé (VIP Diamond, VIP Gold, Regular)
    ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
     'VIP Diamond', 'Khu VIP gần sân khấu. Đồ uống miễn phí, quà lưu niệm, gặp nghệ sĩ',
     2500000, 3000000, 'VND', 500, 87, 13, 4, FALSE,
     '2026-02-01 00:00:00+07', '2026-03-15 17:00:00+07',
     1, '#FFD700', 'ACTIVE', TRUE, FALSE, NOW(), NOW()),

    ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
     'VIP Gold', 'Khu VIP. Đồ uống miễn phí, quà lưu niệm',
     1500000, NULL, 'VND', 2000, 650, 50, 6, FALSE,
     '2026-02-01 00:00:00+07', '2026-03-15 17:00:00+07',
     2, '#FFA500', 'ACTIVE', TRUE, FALSE, NOW(), NOW()),

    ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001',
     'Regular', 'Khu vực đứng',
     500000, NULL, 'VND', 37500, 27300, 200, 8, FALSE,
     '2026-02-01 00:00:00+07', '2026-03-15 17:00:00+07',
     3, '#4CAF50', 'ACTIVE', TRUE, FALSE, NOW(), NOW()),

    -- Ultra Vietnam: 2 loại vé
    ('bbbbbbbb-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000002',
     'VIP 2 ngày', 'Khu riêng biệt, bar VIP, không giới hạn đồ uống',
     4500000, 5000000, 'VND', 1000, 120, 30, 4, FALSE,
     '2026-02-15 00:00:00+07', '2026-04-18 14:00:00+07',
     1, '#9C27B0', 'ACTIVE', TRUE, FALSE, NOW(), NOW()),

    ('bbbbbbbb-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000002',
     'General Admission 2 ngày', 'Khu vực đứng, trải nghiệm EDM đỉnh cao',
     1200000, NULL, 'VND', 14000, 4080, 120, 4, FALSE,
     '2026-02-15 00:00:00+07', '2026-04-18 14:00:00+07',
     2, '#2196F3', 'ACTIVE', TRUE, FALSE, NOW(), NOW()),

    -- Spring Boot Workshop: 2 loại (Early Bird SOLD_OUT + Standard)
    ('bbbbbbbb-0000-0000-0000-000000000021', 'aaaaaaaa-0000-0000-0000-000000000003',
     'Early Bird', 'Giá ưu đãi 50 người đầu tiên. Tài liệu + bữa trưa',
     599000, 799000, 'VND', 50, 0, 0, 2, FALSE,
     '2026-02-10 00:00:00+07', '2026-03-01 23:59:00+07',
     1, '#FF5722', 'SOLD_OUT', TRUE, FALSE, NOW(), NOW()),

    ('bbbbbbbb-0000-0000-0000-000000000022', 'aaaaaaaa-0000-0000-0000-000000000003',
     'Standard', 'Vé tiêu chuẩn. Tài liệu + bữa trưa',
     799000, NULL, 'VND', 150, 20, 5, 2, FALSE,
     '2026-02-10 00:00:00+07', '2026-03-21 23:59:00+07',
     2, '#607D8B', 'ACTIVE', TRUE, FALSE, NOW(), NOW()),

    -- AI Summit: 1 loại vé
    ('bbbbbbbb-0000-0000-0000-000000000031', 'aaaaaaaa-0000-0000-0000-000000000004',
     'Online Pass', 'Link stream, tài liệu PDF, certificate',
     299000, NULL, 'VND', 5000, 2900, 100, 1, FALSE,
     '2026-03-01 00:00:00+07', '2026-05-10 08:00:00+07',
     1, '#00BCD4', 'ACTIVE', TRUE, FALSE, NOW(), NOW()),

    -- Sơn Tùng: 3 loại vé — ALL SOLD_OUT (qty_available=0 ≤ qty_total ✓)
    ('bbbbbbbb-0000-0000-0000-000000000041', 'aaaaaaaa-0000-0000-0000-000000000005',
     'SVIP', 'Hàng ghế đầu. Gặp gỡ & chụp ảnh Sơn Tùng M-TP',
     3500000, NULL, 'VND', 100, 0, 0, 2, TRUE,
     '2026-01-15 00:00:00+07', '2026-03-28 17:00:00+07',
     1, '#E91E63', 'SOLD_OUT', TRUE, FALSE, NOW(), NOW()),

    ('bbbbbbbb-0000-0000-0000-000000000042', 'aaaaaaaa-0000-0000-0000-000000000005',
     'VIP', 'Khu VIP có ghế ngồi',
     1800000, NULL, 'VND', 900, 0, 0, 4, TRUE,
     '2026-01-15 00:00:00+07', '2026-03-28 17:00:00+07',
     2, '#FF4081', 'SOLD_OUT', TRUE, FALSE, NOW(), NOW()),

    ('bbbbbbbb-0000-0000-0000-000000000043', 'aaaaaaaa-0000-0000-0000-000000000005',
     'Regular', 'Khu vực đứng',
     800000, NULL, 'VND', 2500, 0, 0, 6, FALSE,
     '2026-01-15 00:00:00+07', '2026-03-28 17:00:00+07',
     3, '#FF80AB', 'SOLD_OUT', TRUE, FALSE, NOW(), NOW());


-- ============================================================================
-- STEP 7: CẬP NHẬT DENORMALIZED FIELDS
-- ============================================================================
UPDATE event_schema.events e
SET min_price = sub.mp
FROM (
    SELECT event_id, MIN(price) AS mp
    FROM event_schema.ticket_types
    WHERE is_deleted = FALSE
    GROUP BY event_id
) sub
WHERE sub.event_id = e.id;

UPDATE event_schema.events e
SET banner_url = sub.url
FROM (
    SELECT DISTINCT ON (event_id) event_id, image_url AS url
    FROM event_schema.event_images
    WHERE image_type = 'BANNER' AND is_primary = TRUE AND is_deleted = FALSE
    ORDER BY event_id, display_order
) sub
WHERE sub.event_id = e.id;


-- ============================================================================
-- STEP 8: VERIFICATION
-- ============================================================================

-- Tổng quan events + ticket types
SELECT
    e.title,
    e.status,
    CASE WHEN e.is_featured THEN '⭐' ELSE '' END AS featured,
    COALESCE(v.city, 'Online') AS city,
    e.min_price,
    e.tickets_sold,
    COUNT(tt.id) AS ticket_types
FROM event_schema.events e
LEFT JOIN event_schema.venues v ON v.id = e.venue_id
LEFT JOIN event_schema.ticket_types tt ON tt.event_id = e.id AND tt.is_deleted = FALSE
GROUP BY e.id, e.title, e.status, e.is_featured, v.city, e.min_price, e.tickets_sold
ORDER BY e.is_featured DESC, e.status;


-- ============================================================================
-- COMMIT
-- ============================================================================
COMMIT;
