-- Thêm trường mới cho ticket_types
ALTER TABLE event_schema.ticket_types 
    ADD COLUMN IF NOT EXISTS inventory_mode VARCHAR(50) DEFAULT 'QUANTITY' NOT NULL,
    ADD COLUMN IF NOT EXISTS access_scope VARCHAR(50) DEFAULT 'EVENT' NOT NULL;

-- Thêm check constraint an toàn (chỉ thêm nếu chưa tồn tại)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tt_inventory_mode') THEN
        ALTER TABLE event_schema.ticket_types
            ADD CONSTRAINT chk_tt_inventory_mode CHECK (inventory_mode IN ('QUANTITY', 'ASSIGNED_SEAT'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_tt_access_scope') THEN
        ALTER TABLE event_schema.ticket_types
            ADD CONSTRAINT chk_tt_access_scope CHECK (access_scope IN ('EVENT', 'SECTOR'));
    END IF;
END $$;

-- Đồng bộ dữ liệu cũ (Backward Compatibility)
UPDATE event_schema.ticket_types
SET inventory_mode = 'ASSIGNED_SEAT'
WHERE seat_selection_enabled = TRUE;

UPDATE event_schema.ticket_types
SET access_scope = 'SECTOR'
WHERE event_sector_id IS NOT NULL;

-- ============================================================================
-- Dọn dẹp dữ liệu rác (Post-Migration Cleanup & Validation)
-- ============================================================================

-- 1. Chuyển ASSIGNED_SEAT mà thiếu sector_id về QUANTITY
UPDATE event_schema.ticket_types
SET inventory_mode = 'QUANTITY', seat_selection_enabled = FALSE
WHERE inventory_mode = 'ASSIGNED_SEAT' AND event_sector_id IS NULL;

-- 2. Chuyển ASSIGNED_SEAT liên kết nhầm với STANDING sector về QUANTITY
UPDATE event_schema.ticket_types tt
SET inventory_mode = 'QUANTITY', seat_selection_enabled = FALSE
FROM event_schema.event_sectors s
WHERE tt.event_sector_id = s.id 
  AND s.sector_type = 'STANDING' 
  AND tt.inventory_mode = 'ASSIGNED_SEAT';

-- 3. Tạm thời ẩn các Ticket Type liên kết với các sector_type chưa hỗ trợ (VIP_BOX, ACCESSIBLE)
UPDATE event_schema.ticket_types tt
SET status = 'HIDDEN', is_visible = false
FROM event_schema.event_sectors s
WHERE tt.event_sector_id = s.id
  AND s.sector_type IN ('VIP_BOX', 'ACCESSIBLE');
