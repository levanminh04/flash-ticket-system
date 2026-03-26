-- ============================================================================
-- V6__event_layout_tables.sql
-- ============================================================================
-- Mục tiêu: Chuyển sang Event-Centric Layout Model
--
-- THAY ĐỔI:
--   1. Thêm `seat_map_config` JSONB vào event_schema.venues
--   2. Cập nhật CHECK constraint events.status: thêm 'PENDING_APPROVAL'
--   3. Tạo event_schema.event_layouts (per-event layout metadata)
--   4. Tạo event_schema.event_sectors (per-event sectors)
--   5. Tạo event_schema.event_seats (per-event seats)
--   6. Thêm `event_sector_id` vào event_schema.ticket_types
--   7. Thêm `event_seat_id` vào event_schema.event_seat_inventory
--   8. Xóa FK/cột cũ: ticket_types.sector_id, event_seat_inventory.seat_id
--   9. DROP bảng venue_seats, venue_sectors (không cần nữa)
--
-- Áp dụng lên DB đã có V2, V3, V4, V5.
-- Flyway sẽ chạy file này sau V5.
-- ============================================================================

-- ============================================================================
-- STEP 1: Thêm seat_map_config vào venues
-- ============================================================================
ALTER TABLE event_schema.venues
    ADD COLUMN IF NOT EXISTS seat_map_config JSONB DEFAULT '{}';

COMMENT ON COLUMN event_schema.venues.seat_map_config IS
    'Config cho Seat Map Designer: zoom levels, grid size, viewport defaults';

-- ============================================================================
-- STEP 2: Cập nhật CHECK constraint events.status
-- Thêm trạng thái PENDING_APPROVAL vào workflow Admin duyệt
-- ============================================================================
ALTER TABLE event_schema.events
    DROP CONSTRAINT IF EXISTS chk_event_status;

ALTER TABLE event_schema.events
    ADD CONSTRAINT chk_event_status
    CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'CANCELLED', 'COMPLETED', 'SOLD_OUT'));

CREATE INDEX IF NOT EXISTS idx_events_pending
    ON event_schema.events(status, created_at DESC)
    WHERE is_deleted = FALSE AND status = 'PENDING_APPROVAL';

-- ============================================================================
-- STEP 3: Tạo event_schema.event_layouts
-- ============================================================================
CREATE TABLE IF NOT EXISTS event_schema.event_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES event_schema.events(id) ON DELETE CASCADE,
    name VARCHAR(255),
    background_image_url VARCHAR(500),
    background_public_id VARCHAR(255),
    background_width INT,
    background_height INT,
    map_config JSONB DEFAULT '{}',
    source_type VARCHAR(50) DEFAULT 'CUSTOM',
    source_id UUID,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR(255),
    CONSTRAINT uk_event_layout UNIQUE (event_id),
    CONSTRAINT chk_layout_source_type CHECK (source_type IN ('CUSTOM', 'CLONED_FROM_VENUE', 'CLONED_FROM_EVENT'))
);

CREATE INDEX IF NOT EXISTS idx_event_layouts_event
    ON event_schema.event_layouts(event_id);

-- ============================================================================
-- STEP 4: Tạo event_schema.event_sectors
-- ============================================================================
CREATE TABLE IF NOT EXISTS event_schema.event_sectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    layout_id UUID NOT NULL REFERENCES event_schema.event_layouts(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20),
    description TEXT,
    sector_type VARCHAR(50) NOT NULL,
    total_capacity INT NOT NULL,
    map_data JSONB DEFAULT '{}',
    color_code VARCHAR(7),
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_event_sector_type CHECK (sector_type IN ('SEATED', 'STANDING', 'VIP_BOX', 'ACCESSIBLE'))
);

CREATE INDEX IF NOT EXISTS idx_event_sectors_layout
    ON event_schema.event_sectors(layout_id);
CREATE INDEX IF NOT EXISTS idx_event_sectors_active
    ON event_schema.event_sectors(layout_id, is_active);

-- ============================================================================
-- STEP 5: Tạo event_schema.event_seats
-- ============================================================================
CREATE TABLE IF NOT EXISTS event_schema.event_seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sector_id UUID NOT NULL REFERENCES event_schema.event_sectors(id) ON DELETE CASCADE,
    row_name VARCHAR(10) NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    seat_label VARCHAR(20),
    coord_x DECIMAL(10, 2) NOT NULL,
    coord_y DECIMAL(10, 2) NOT NULL,
    coord_metadata JSONB DEFAULT '{}',
    seat_type VARCHAR(50) DEFAULT 'REGULAR',
    is_aisle BOOLEAN DEFAULT FALSE,
    has_obstruction BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_event_seat_type CHECK (seat_type IN ('REGULAR', 'WHEELCHAIR', 'COMPANION', 'PREMIUM', 'RESTRICTED')),
    CONSTRAINT uk_event_sector_row_seat UNIQUE (sector_id, row_name, seat_number)
);

CREATE INDEX IF NOT EXISTS idx_event_seats_sector
    ON event_schema.event_seats(sector_id);
CREATE INDEX IF NOT EXISTS idx_event_seats_active
    ON event_schema.event_seats(sector_id, is_active);

-- ============================================================================
-- STEP 6: ticket_types — thêm event_sector_id, xóa sector_id cũ
-- ============================================================================
-- 6a. Thêm cột mới
ALTER TABLE event_schema.ticket_types
    ADD COLUMN IF NOT EXISTS event_sector_id UUID
    REFERENCES event_schema.event_sectors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_types_event_sector
    ON event_schema.ticket_types(event_sector_id)
    WHERE is_deleted = FALSE;

-- 6b. Xóa FK cũ sector_id → venue_sectors (nếu tồn tại)
-- Phải xóa index + FK constraint trước khi DROP column
DROP INDEX IF EXISTS event_schema.idx_ticket_types_sector;

-- FK constraint name auto-generated bởi PostgreSQL, tìm và xóa:
DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT constraint_name INTO fk_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'event_schema'
      AND table_name = 'ticket_types'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%sector_id%';

    IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE event_schema.ticket_types DROP CONSTRAINT %I', fk_name);
        RAISE NOTICE 'Dropped FK constraint: %', fk_name;
    END IF;

    -- Fallback: also try the default naming pattern
    IF fk_name IS NULL THEN
        SELECT tc.constraint_name INTO fk_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_schema = 'event_schema'
          AND tc.table_name = 'ticket_types'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND ccu.column_name = 'sector_id';

        IF fk_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE event_schema.ticket_types DROP CONSTRAINT %I', fk_name);
            RAISE NOTICE 'Dropped FK constraint (fallback): %', fk_name;
        END IF;
    END IF;
END $$;

-- 6c. DROP column sector_id
ALTER TABLE event_schema.ticket_types
    DROP COLUMN IF EXISTS sector_id;

-- ============================================================================
-- STEP 7: event_seat_inventory — thêm event_seat_id, xóa seat_id cũ
-- ============================================================================
-- 7a. Thêm cột mới
ALTER TABLE event_schema.event_seat_inventory
    ADD COLUMN IF NOT EXISTS event_seat_id UUID
    REFERENCES event_schema.event_seats(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_seat_inventory_event_seat
    ON event_schema.event_seat_inventory(event_seat_id);

-- 7b. Xóa constraint + FK + column cũ seat_id → venue_seats
DROP INDEX IF EXISTS event_schema.idx_seat_inventory_seat;

-- Xóa UNIQUE constraint uk_event_seat (event_id, seat_id)
ALTER TABLE event_schema.event_seat_inventory
    DROP CONSTRAINT IF EXISTS uk_event_seat;

-- Tìm và xóa FK constraint trên seat_id
DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT tc.constraint_name INTO fk_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_schema = 'event_schema'
      AND tc.table_name = 'event_seat_inventory'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.column_name = 'seat_id';

    IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE event_schema.event_seat_inventory DROP CONSTRAINT %I', fk_name);
        RAISE NOTICE 'Dropped FK constraint on seat_id: %', fk_name;
    END IF;
END $$;

-- 7c. DROP column seat_id
ALTER TABLE event_schema.event_seat_inventory
    DROP COLUMN IF EXISTS seat_id;

-- 7d. Thêm UNIQUE constraint mới (event_id, event_seat_id)
-- Chỉ thêm nếu chưa có
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'event_schema'
          AND table_name = 'event_seat_inventory'
          AND constraint_name = 'uk_event_event_seat'
    ) THEN
        ALTER TABLE event_schema.event_seat_inventory
            ADD CONSTRAINT uk_event_event_seat UNIQUE (event_id, event_seat_id);
    END IF;
END $$;

-- ============================================================================
-- STEP 8: DROP bảng cũ venue_seats, venue_sectors
-- venue_seats phải drop trước vì có FK → venue_sectors
-- ============================================================================
DROP TABLE IF EXISTS event_schema.venue_seats CASCADE;
DROP TABLE IF EXISTS event_schema.venue_sectors CASCADE;

-- ============================================================================
-- STEP 9: Trigger updated_at cho các bảng mới
-- ============================================================================
DROP TRIGGER IF EXISTS update_updated_at ON event_schema.event_layouts;
CREATE TRIGGER update_updated_at
    BEFORE UPDATE ON event_schema.event_layouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_updated_at ON event_schema.event_sectors;
CREATE TRIGGER update_updated_at
    BEFORE UPDATE ON event_schema.event_sectors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
    -- Bảng mới đã tồn tại
    ASSERT (SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema = 'event_schema'
            AND table_name IN ('event_layouts', 'event_sectors', 'event_seats')) = 3,
        'FAIL: Chưa tạo đủ 3 bảng mới';

    -- ticket_types có event_sector_id, KHÔNG còn sector_id
    ASSERT (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'event_schema' AND table_name = 'ticket_types'
            AND column_name = 'event_sector_id') = 1,
        'FAIL: ticket_types thiếu cột event_sector_id';

    ASSERT (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'event_schema' AND table_name = 'ticket_types'
            AND column_name = 'sector_id') = 0,
        'FAIL: ticket_types vẫn còn cột sector_id cũ';

    -- event_seat_inventory có event_seat_id, KHÔNG còn seat_id
    ASSERT (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'event_schema' AND table_name = 'event_seat_inventory'
            AND column_name = 'event_seat_id') = 1,
        'FAIL: event_seat_inventory thiếu cột event_seat_id';

    ASSERT (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'event_schema' AND table_name = 'event_seat_inventory'
            AND column_name = 'seat_id') = 0,
        'FAIL: event_seat_inventory vẫn còn cột seat_id cũ';

    -- venue_sectors, venue_seats đã bị xóa
    ASSERT (SELECT COUNT(*) FROM information_schema.tables
            WHERE table_schema = 'event_schema'
            AND table_name IN ('venue_sectors', 'venue_seats')) = 0,
        'FAIL: venue_sectors hoặc venue_seats vẫn còn tồn tại';

    -- venues có seat_map_config
    ASSERT (SELECT COUNT(*) FROM information_schema.columns
            WHERE table_schema = 'event_schema' AND table_name = 'venues'
            AND column_name = 'seat_map_config') = 1,
        'FAIL: venues thiếu cột seat_map_config';

    RAISE NOTICE 'V6 migration PASSED: Event-centric layout model hoàn tất, venue_sectors/venue_seats đã bị xóa';
END $$;

-- ============================================================================
-- END V6__event_layout_tables.sql
-- ============================================================================
-- Sau migration này, DB:
--   + event_schema.event_layouts, event_sectors, event_seats
--   + event_schema.venues.seat_map_config
--   + event_schema.ticket_types.event_sector_id (thay sector_id cũ)
--   + event_schema.event_seat_inventory.event_seat_id (thay seat_id cũ)
--   + events.status thêm 'PENDING_APPROVAL'
--   - DELETED: venue_sectors, venue_seats, ticket_types.sector_id,
--              event_seat_inventory.seat_id
-- ============================================================================
