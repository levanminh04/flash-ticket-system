-- ============================================================================
-- Migration: Add missing user_id column to booking_schema.tickets
-- Version: V5__add_user_id_to_tickets.sql
-- Root cause: Ticket.java entity có field user_id nhưng V2 chưa tạo cột này.
-- ============================================================================

ALTER TABLE booking_schema.tickets
    ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);

-- Backfill từ orders (nếu đã có data)
UPDATE booking_schema.tickets t
SET user_id = o.user_id
FROM booking_schema.orders o
WHERE t.order_id = o.id
  AND t.user_id IS NULL;

-- Sau khi backfill xong, set NOT NULL
ALTER TABLE booking_schema.tickets
    ALTER COLUMN user_id SET NOT NULL;

-- Index khớp với @Index(name = "idx_tickets_user", columnList = "user_id") trong Ticket.java
CREATE INDEX IF NOT EXISTS idx_tickets_user
    ON booking_schema.tickets(user_id)
    WHERE is_deleted = FALSE;

COMMENT ON COLUMN booking_schema.tickets.user_id IS
    'Keycloak subject claim (String UUID). Hiện tại: logical ref, không FK vì chưa có bảng users trong DB.
     Tương lai: sau khi sync Keycloak → user_schema.users, cân nhắc thêm FK — nhưng cross-schema FK
     thường bị bỏ qua khi chuẩn bị cho microservice extraction.';
