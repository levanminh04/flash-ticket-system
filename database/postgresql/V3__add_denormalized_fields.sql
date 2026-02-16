-- ============================================================================
-- Migration Script: Add Denormalized Fields to Events Table
-- Version: V3__add_denormalized_fields.sql
-- Purpose: Add min_price and banner_url columns for performance optimization
-- ============================================================================

-- Add denormalized columns to events table
ALTER TABLE event_schema.events 
ADD COLUMN IF NOT EXISTS min_price DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS banner_url VARCHAR(500);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_min_price ON event_schema.events(min_price) 
    WHERE is_deleted = FALSE AND status = 'PUBLISHED';

CREATE INDEX IF NOT EXISTS idx_events_status_deleted ON event_schema.events(status, is_deleted);

CREATE INDEX IF NOT EXISTS idx_events_start_datetime ON event_schema.events(start_datetime) 
    WHERE is_deleted = FALSE AND status = 'PUBLISHED';

CREATE INDEX IF NOT EXISTS idx_events_featured ON event_schema.events(is_featured) 
    WHERE is_deleted = FALSE AND status = 'PUBLISHED';

-- Optimize venue city filter
CREATE INDEX IF NOT EXISTS idx_venues_city ON event_schema.venues(city);

-- Optimize ticket price queries
CREATE INDEX IF NOT EXISTS idx_ticket_types_event_price ON event_schema.ticket_types(event_id, price);

-- Optimize category filter
CREATE INDEX IF NOT EXISTS idx_event_categories_category ON event_schema.event_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_event_categories_event ON event_schema.event_categories(event_id);

-- Optimize event images queries
CREATE INDEX IF NOT EXISTS idx_event_images_event_type_primary 
    ON event_schema.event_images(event_id, image_type, is_primary) 
    WHERE is_deleted = FALSE;

-- Comments
COMMENT ON COLUMN event_schema.events.min_price IS 'Denormalized: MIN(ticket_types.price) - Update khi tạo/sửa/xóa TicketType';
COMMENT ON COLUMN event_schema.events.banner_url IS 'Denormalized: event_images (type=BANNER, is_primary=true).image_url - Update khi upload/delete banner';

-- ============================================================================
-- Initial Data Population (Optional)
-- Populate min_price từ existing ticket_types
-- ============================================================================

-- Update min_price for existing events
UPDATE event_schema.events e
SET min_price = (
    SELECT MIN(tt.price)
    FROM event_schema.ticket_types tt
    WHERE tt.event_id = e.id
      AND tt.is_deleted = FALSE
)
WHERE e.is_deleted = FALSE;

-- Update banner_url for existing events (if event_images already has data)
UPDATE event_schema.events e
SET banner_url = (
    SELECT ei.image_url
    FROM event_schema.event_images ei
    WHERE ei.event_id = e.id
      AND ei.image_type = 'BANNER'
      AND ei.is_primary = TRUE
      AND ei.is_deleted = FALSE
    LIMIT 1
)
WHERE e.is_deleted = FALSE;

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check indexes created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'event_schema'
  AND tablename IN ('events', 'venues', 'ticket_types', 'event_categories', 'event_images')
ORDER BY tablename, indexname;

-- Check denormalized fields populated
SELECT 
    COUNT(*) as total_events,
    COUNT(min_price) as events_with_min_price,
    COUNT(banner_url) as events_with_banner_url
FROM event_schema.events
WHERE is_deleted = FALSE;
