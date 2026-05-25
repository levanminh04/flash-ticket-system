-- ============================================================================
-- V8: Seat-level TicketType assignment for multi-price seated sectors
-- ============================================================================
-- Purpose:
--   - Allow one SEATED sector to contain multiple TicketTypes by assigning each
--     physical seat to exactly one TicketType/price area.
--   - Keep event_seat_inventory.ticket_type_id as a denormalized snapshot for
--     fast booking validation.
--   - Add an optional seat color snapshot for FE rendering. Booking logic must
--     not depend on color_code.
--
-- Notes:
--   - ticket_types.color_code remains the primary color for a TicketType.
--   - event_seats.color_code is a display helper/snapshot for seat-map reload.
-- ============================================================================

ALTER TABLE event_schema.event_seats
    ADD COLUMN IF NOT EXISTS ticket_type_id UUID,
    ADD COLUMN IF NOT EXISTS color_code VARCHAR(7);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_event_seats_ticket_type_id'
          AND conrelid = 'event_schema.event_seats'::regclass
    ) THEN
        ALTER TABLE event_schema.event_seats
            ADD CONSTRAINT fk_event_seats_ticket_type_id
            FOREIGN KEY (ticket_type_id)
            REFERENCES event_schema.ticket_types(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_event_seats_ticket_type
    ON event_schema.event_seats(ticket_type_id);

-- Backfill from existing inventory rows created by earlier Phase A publish flow.
-- If a seat has an inventory ticket_type_id, that value becomes the initial
-- seat-level assignment.
UPDATE event_schema.event_seats s
SET ticket_type_id = i.ticket_type_id
FROM event_schema.event_seat_inventory i
WHERE i.event_seat_id = s.id
  AND i.ticket_type_id IS NOT NULL
  AND s.ticket_type_id IS NULL;

-- Backfill/normalize display color from the assigned TicketType. TicketType is
-- the color source of truth; seat color is only a snapshot for map reload.
UPDATE event_schema.event_seats s
SET color_code = tt.color_code
FROM event_schema.ticket_types tt
WHERE s.ticket_type_id = tt.id
  AND s.color_code IS DISTINCT FROM tt.color_code;

COMMENT ON COLUMN event_schema.event_seats.ticket_type_id IS
    'TicketType/vùng giá của ghế trong SEATED sector; source of truth để sync sang event_seat_inventory.ticket_type_id';

COMMENT ON COLUMN event_schema.event_seats.color_code IS
    'Màu hiển thị ghế trên FE; không dùng cho booking validation';

COMMENT ON COLUMN event_schema.event_seat_inventory.ticket_type_id IS
    'Snapshot từ event_seats.ticket_type_id để booking validate nhanh seat thuộc đúng TicketType';
