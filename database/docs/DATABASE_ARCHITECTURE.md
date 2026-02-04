# 📋 Database Architecture Documentation

## TicketBox - Scale-Ready Database Design

> **Version**: 1.0.0  
> **Author**: TicketBox Team  
> **Last Updated**: 2026-02-05

---

## 1. Tổng Quan Kiến Trúc

### 1.1. Database Distribution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────┐    ┌──────────────────────────────┐   │
│  │         PostgreSQL               │    │         MongoDB              │   │
│  │    (Core Service Data)           │    │    (User Service Data)       │   │
│  │                                  │    │                              │   │
│  │  ┌────────────────────────────┐  │    │  ┌────────────────────────┐  │   │
│  │  │     event_schema           │  │    │  │      users             │  │   │
│  │  │  • events                  │  │    │  │      organizer_profiles│  │   │
│  │  │  • ticket_types            │  │    │  │      refresh_tokens    │  │   │
│  │  │  • categories              │  │    │  │      activity_logs     │  │   │
│  │  │  • venues                  │  │    │  └────────────────────────┘  │   │
│  │  └────────────────────────────┘  │    │                              │   │
│  │                                  │    └──────────────────────────────┘   │
│  │  ┌────────────────────────────┐  │                                       │
│  │  │    booking_schema          │  │    ┌──────────────────────────────┐   │
│  │  │  • orders                  │  │    │     PostgreSQL + pgvector    │   │
│  │  │  • order_items             │  │    │      (AI Service Data)       │   │
│  │  │  • tickets                 │  │    │                              │   │
│  │  │  • carts                   │  │    │  ┌────────────────────────┐  │   │
│  │  │  • reservations            │  │    │  │      ai_schema         │  │   │
│  │  └────────────────────────────┘  │    │  │  • documents           │  │   │
│  │                                  │    │  │  • conversations       │  │   │
│  │  ┌────────────────────────────┐  │    │  │  • messages            │  │   │
│  │  │    payment_schema          │  │    │  └────────────────────────┘  │   │
│  │  │  • transactions            │  │    │                              │   │
│  │  │  • refunds                 │  │    └──────────────────────────────┘   │
│  │  └────────────────────────────┘  │                                       │
│  │                                  │                                       │
│  └──────────────────────────────────┘                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2. Why This Design?

| Decision | Lý do | Benefit khi Scale |
|----------|-------|-------------------|
| **Schema Isolation** | Mỗi module có schema riêng | Extract module thành service chỉ cần migrate schema |
| **UUID Primary Key** | Tránh ID collision khi merge | Dễ dàng sharding, không leak business metrics |
| **Logical References** | Cross-schema dùng UUID, không FK | Tách service không ảnh hưởng data integrity |
| **Denormalized Fields** | Cache data từ service khác | Giảm cross-service calls, tăng performance |
| **Audit Columns** | Tracking mọi changes | Debugging, compliance, undo support |
| **Soft Delete** | is_deleted flag | Data recovery, audit trail |

---

## 2. PostgreSQL Schema Details

### 2.1. Schema Isolation Strategy

```sql
-- Hiện tại: Chung database, khác schema
+-----------------+
|   ticketbox     |  <-- 1 Database
|-----------------|
| event_schema    |  <-- Event Module
| booking_schema  |  <-- Booking Module  
| payment_schema  |  <-- Payment Module
| ai_schema       |  <-- AI Module
+-----------------+

-- Tương lai: Mỗi schema tách thành database riêng
+-----------------+  +-----------------+  +-----------------+
| ticketbox_event |  | ticketbox_book  |  | ticketbox_pay   |
|-----------------|  |-----------------|  |-----------------|
| event_schema    |  | booking_schema  |  | payment_schema  |
+-----------------+  +-----------------+  +-----------------+
        ↓                    ↓                    ↓
   Event Service       Booking Service       Payment Service
```

### 2.2. Cross-Schema References

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CROSS-SCHEMA RELATIONSHIP STRATEGY                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐         Logical Reference         ┌─────────────────┐  │
│  │ booking_schema  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ▶ │  event_schema   │  │
│  │    orders       │         (NO Foreign Key)          │    events       │  │
│  │                 │                                    │                 │  │
│  │  event_id: UUID │  "Chỉ lưu UUID, không ràng buộc"  │  id: UUID       │  │
│  │  event_title    │  "Cache title để hiển thị"        │  title          │  │
│  │  event_datetime │  "Cache datetime để sort"         │  start_datetime │  │
│  └─────────────────┘                                    └─────────────────┘  │
│                                                                              │
│  TRONG CÙNG SCHEMA (OK để dùng FK):                                          │
│                                                                              │
│  ┌─────────────────┐         Hard Foreign Key          ┌─────────────────┐  │
│  │  event_schema   │ ════════════════════════════════▶ │  event_schema   │  │
│  │  ticket_types   │                                    │    events       │  │
│  │                 │                                    │                 │  │
│  │  event_id: FK   │──────────────────────────────────▶│  id: PK         │  │
│  └─────────────────┘                                    └─────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Tại sao không dùng FK giữa các schema?**

1. **Physical Separation**: Khi tách thành microservices, mỗi schema sẽ nằm ở database server khác nhau → FK không hoạt động
2. **Independent Deployment**: Service A có thể deploy/rollback mà không ảnh hưởng Service B
3. **Performance**: FK check có chi phí, cross-database FK còn tệ hơn
4. **Flexibility**: Có thể thêm/xóa field mà không cần coordinate giữa các teams

### 2.3. Table Relationship Diagram

```
                              EVENT_SCHEMA
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │  categories  │◄────┤│    events    │├────►│   venues     │  │
│  └──────────────┘      └──────┬───────┘      └──────────────┘  │
│         │                     │                                 │
│         │ parent_id           │ event_id                        │
│         ▼                     ▼                                 │
│  ┌──────────────┐      ┌──────────────┐                        │
│  │  categories  │      │ ticket_types │                        │
│  │  (self-ref)  │      └──────────────┘                        │
│  └──────────────┘                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
           ║ event_id (logical ref)
           ║ ticket_type_id (logical ref)
           ▼
                             BOOKING_SCHEMA
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │    carts     │◄────┤│  cart_items  │      │ reservations │  │
│  └──────────────┘      └──────────────┘      └──────────────┘  │
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │    orders    │◄────┤│ order_items  │      │   tickets    │  │
│  └──────┬───────┘      └──────────────┘      └──────────────┘  │
│         │                                           ▲          │
│         └───────────────────────────────────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
           ║ order_id (logical ref)
           ▼
                             PAYMENT_SCHEMA
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌──────────────┐      ┌──────────────┐                        │
│  │ transactions │◄────┤│   refunds    │                        │
│  └──────────────┘      └──────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. UUID Strategy

### 3.1. Why UUID instead of Auto-Increment?

| Aspect | Auto-Increment | UUID |
|--------|----------------|------|
| **Sharding** | ❌ ID collision khi merge shards | ✅ Globally unique |
| **Security** | ❌ Lộ business metrics (order #1000000) | ✅ Không đoán được |
| **Distributed** | ❌ Cần central ID generator | ✅ Generate ở bất kỳ node |
| **Pre-generation** | ❌ Cần INSERT trước | ✅ Generate trước khi INSERT |
| **Performance** | ✅ Faster insert (clustered) | ⚠️ Slightly slower (random) |

### 3.2. UUID Generation

```sql
-- PostgreSQL sử dụng uuid-ossp extension
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()

-- Hoặc sử dụng gen_random_uuid() (pg 13+)
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

### 3.3. UUID Performance Optimization

```sql
-- Sử dụng BRIN index thay vì B-Tree cho UUID columns có timestamp correlation
CREATE INDEX idx_orders_created_brin ON booking_schema.orders 
    USING brin(created_at);

-- Hoặc sử dụng UUIDv7 (time-ordered) nếu cần
-- UUIDv7 có timestamp prefix giúp clustered insert tốt hơn
```

---

## 4. MongoDB Schema Design

### 4.1. Document Structure Philosophy

```javascript
// Embedded vs Reference Strategy

// EMBEDDED (trong cùng document) - Khi:
// - Data luôn được access cùng nhau
// - 1:1 hoặc 1:few relationship
// - Data không thay đổi thường xuyên

users: {
  _id: UUID,
  email: "...",
  profile: {           // ← EMBEDDED
    firstName: "...",
    lastName: "...",
    avatarUrl: "..."
  },
  addresses: [...]     // ← EMBEDDED ARRAY (ít items)
}

// REFERENCE (separate collection) - Khi:
// - Data có thể truy cập độc lập
// - 1:many với many lớn
// - Data thay đổi thường xuyên

users: {
  _id: UUID,
  organizerProfileId: UUID   // ← REFERENCE
}

organizer_profiles: {
  _id: UUID,
  userId: UUID,              // ← BACK REFERENCE
  ...
}
```

### 4.2. Index Strategy

```javascript
// Primary access patterns
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "keycloakId": 1 }, { unique: true });

// Search queries
db.users.createIndex({ "profile.displayName": "text" });

// Admin listing
db.users.createIndex({ "status": 1, "roles": 1, "createdAt": -1 });

// TTL for auto-expiry
db.refresh_tokens.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0 });
db.user_activity_logs.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 7776000 }); // 90 days
```

---

## 5. Migration Strategy to Microservices

### 5.1. Phase 1: Modular Monolith (Current)

```
┌─────────────────────────────────────────┐
│            Core Service                  │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ Event   │ │ Booking │ │ Payment │   │
│  │ Module  │ │ Module  │ │ Module  │   │
│  └────┬────┘ └────┬────┘ └────┬────┘   │
│       │           │           │         │
│       ▼           ▼           ▼         │
│  ┌─────────────────────────────────┐   │
│  │        PostgreSQL                │   │
│  │  event_ │ booking_ │ payment_   │   │
│  │  schema │ schema   │ schema     │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 5.2. Phase 2: Extract First Service

```
┌─────────────────────────────────────────┐   ┌─────────────────────┐
│            Core Service                  │   │   Event Service     │
│  ┌─────────┐ ┌─────────┐                │   │                     │
│  │ Booking │ │ Payment │                │   │   event_schema      │
│  │ Module  │ │ Module  │                │   │   (separate DB)     │
│  └────┬────┘ └────┬────┘                │   └─────────────────────┘
│       │           │                      │            ▲
│       ▼           ▼                      │            │
│  ┌─────────────────────────────────┐    │     HTTP/gRPC
│  │   booking_schema │ payment_     │    │            │
│  │                  │ schema       │◄───┼────────────┘
│  └─────────────────────────────────┘    │   (API call thay vì
└─────────────────────────────────────────┘    direct DB access)
```

### 5.3. Phase 3: Full Microservices

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Event Service  │  │ Booking Service │  │ Payment Service │
│                 │  │                 │  │                 │
│  event_schema   │  │ booking_schema  │  │ payment_schema  │
│  (PostgreSQL-1) │  │ (PostgreSQL-2)  │  │ (PostgreSQL-3)  │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │      Kafka      │
                    │ (Event-Driven)  │
                    └─────────────────┘
```

### 5.4. Migration Steps

```
Step 1: Tách Schema → Separate Connection
────────────────────────────────────────────
- Tạo connection mới cho event_schema
- Service vẫn trong cùng codebase
- Test logic hoạt động bình thường

Step 2: Create Separate Database
────────────────────────────────────────────
- pg_dump event_schema → new database
- Update connection string
- Verify data integrity

Step 3: Extract Service
────────────────────────────────────────────
- Copy event module code → new project
- Replace direct calls với HTTP/gRPC
- Deploy independently

Step 4: Remove Old Code
────────────────────────────────────────────
- Remove event module từ Core Service
- Drop event_schema từ old database
- Done!
```

---

## 6. Data Consistency Patterns

### 6.1. Cross-Service Data Sync

```
                         ┌─────────────────┐
                         │     Kafka       │
                         └────────┬────────┘
                                  │
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
            ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  Event Service  │   │ Booking Service │   │   AI Service    │
│                 │   │                 │   │                 │
│  Publish:       │   │  Subscribe:     │   │  Subscribe:     │
│  EVENT_CREATED  │──▶│  EVENT_CREATED  │   │  EVENT_CREATED  │
│  EVENT_UPDATED  │──▶│  EVENT_UPDATED  │   │  (index for RAG)│
│                 │   │  (cache update) │   │                 │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

### 6.2. Eventual Consistency Handling

```java
// Booking Service: Lưu denormalized event data
@Entity
public class Order {
    // Logical reference
    private UUID eventId;
    
    // Cached data (có thể stale)
    private String eventTitle;
    private LocalDateTime eventStartDatetime;
    private String eventVenueName;
    
    // Flag để biết data có thể cần refresh
    private LocalDateTime eventDataCachedAt;
}

// Khi nhận EVENT_UPDATED từ Kafka
@KafkaListener(topics = "event.updated")
public void onEventUpdated(EventUpdatedEvent event) {
    orderRepository.updateEventCache(
        event.getEventId(),
        event.getTitle(),
        event.getStartDatetime(),
        event.getVenueName()
    );
}
```

---

## 7. Summary: Tại Sao Design Này Dễ Tách Microservices?

| # | Design Decision | Microservices Benefit |
|---|-----------------|----------------------|
| 1 | **Schema Isolation** | `pg_dump schema_name` → immediate extraction |
| 2 | **UUID Keys** | Merge data từ nhiều instances không conflict |
| 3 | **No Cross-Schema FK** | Tách database không break constraints |
| 4 | **Denormalized Cache** | Service độc lập, không cần sync calls |
| 5 | **Logical References** | Chuyển từ DB query → HTTP call transparent |
| 6 | **Audit Columns** | Track changes cho debugging khi distributed |
| 7 | **Soft Delete** | Eventual consistency - không mất data |

### Ước Tính Effort Khi Tách:

| Module → Service | Estimated Effort | Reason |
|-----------------|------------------|--------|
| Event Module | 2-3 days | Most independent, ít dependencies |
| Payment Module | 3-4 days | Cần integrate payment gateway |
| Booking Module | 1 week | Nhiều dependencies, core business |

---

## 8. File Structure

```
database/
├── postgresql/
│   ├── V1__init_schema.sql          # Main DDL script
│   ├── V2__add_indexes.sql          # Additional indexes (optional)
│   └── V3__sample_data.sql          # Development data (optional)
│
├── mongodb/
│   ├── user_service_schema.js       # Schema validation + indexes
│   └── sample_data.js               # Development data (optional)
│
└── docs/
    └── DATABASE_ARCHITECTURE.md     # This document
```

---

*Tài liệu này được tạo để giúp team hiểu và maintain database architecture. Mọi thay đổi schema cần được document và review.*
