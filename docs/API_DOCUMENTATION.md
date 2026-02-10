# 📘 TicketBox Flash Ticket System — API Design Documentation

> **Version**: 1.0.0  
> **Last Updated**: 2026-02-10  
> **Authors**: TicketBox Team  
> **Architecture**: Modular Monolith (Microservices-ready)

---

## Table of Contents

1. [API Overview & Conventions](#part-1-api-overview--conventions)
2. [User Service APIs](#part-2-user-service-apis)
3. [Core Service — Events Module](#part-3-core-service-apis--events-module)
4. [Core Service — Booking Module](#part-4-core-service-apis--booking-module)
5. [Core Service — Payment Module](#part-5-core-service-apis--payment-module)
6. [Core Service — Promotion Module](#part-6-core-service-apis--promotion-module)
7. [Core Service — Admin & Dashboard APIs](#part-7-admin--dashboard-apis)
8. [Error Handling & Codes](#part-8-error-handling--codes)
9. [Security Considerations](#part-9-security-considerations)
10. [API Priority Classification](#part-10-api-priority-classification)

---

# PART 1: API Overview & Conventions

## 1.1. Base URLs

| Environment | URL | Notes |
|-------------|-----|-------|
| **API Gateway (Dev)** | `http://localhost:8080` | Frontend calls this only |
| User Service (Internal) | `http://localhost:8081` | Inter-service only |
| Core Service (Internal) | `http://localhost:8082` | Inter-service only |
| AI Service (Internal) | `http://localhost:8085` | Inter-service only |
| **API Gateway (Prod)** | `https://api.ticketbox.example.com` | Production |

> [!IMPORTANT]
> Frontend **MUST** only call the API Gateway (`localhost:8080`). Direct service calls are for inter-service communication only.

## 1.2. API Versioning

```
Format: /api/v1/{resource}
Example: /api/v1/events
```

- **v1**: Current stable version
- Breaking changes → increment version (`v2`)
- Backward compatible changes → same version

## 1.3. Authentication Flow (Keycloak)

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant KC as Keycloak (:9090)
    participant GW as API Gateway (:8080)
    participant BE as Backend Service

    FE->>KC: 1. Redirect to /realms/ticketbox/protocol/openid-connect/auth
    KC->>FE: 2. Login page
    FE->>KC: 3. User enters credentials
    KC->>FE: 4. Redirect back with authorization code
    FE->>KC: 5. POST /token (exchange code for tokens)
    KC->>FE: 6. Access Token (JWT) + Refresh Token
    FE->>GW: 7. API call with Authorization: Bearer <token>
    GW->>KC: 8. Validate JWT via JWKS endpoint
    GW->>BE: 9. Forward request with user context
    BE->>GW: 10. Response
    GW->>FE: 11. Response
```

**Authorization Header**:
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

**JWT Token Claims** (decoded):
```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440001",
  "email": "buyer@ticketbox.vn",
  "preferred_username": "buyer1",
  "realm_access": {
    "roles": ["BUYER"]
  },
  "iat": 1707580200,
  "exp": 1707583800
}
```

**Keycloak Endpoints** (for Frontend):
| Endpoint | Usage |
|----------|-------|
| `POST /realms/ticketbox/protocol/openid-connect/token` | Exchange code / refresh token |
| `GET /realms/ticketbox/protocol/openid-connect/auth` | Login redirect |
| `GET /realms/ticketbox/protocol/openid-connect/logout` | Logout redirect |

## 1.4. Common Request Headers

| Header | Required | Description | Example |
|--------|----------|-------------|---------|
| `Authorization` | Yes* | JWT Bearer token (*except public APIs) | `Bearer eyJhbGc...` |
| `Content-Type` | Yes (POST/PUT/PATCH) | Request body format | `application/json` |
| `Accept` | No | Response format | `application/json` |
| `X-Request-ID` | No | Request tracing | `f47ac10b-58cc-4372-a567-0e02b2c3d479` |
| `Accept-Language` | No | i18n support | `vi-VN` |

## 1.5. Standard Response Format

**Success Response** (single object):
```json
{
  "success": true,
  "data": { "id": "...", "title": "..." },
  "message": "Operation successful",
  "timestamp": "2026-02-10T10:30:00Z"
}
```

**Success Response** (paginated list):
```json
{
  "success": true,
  "data": {
    "content": [ { ... }, { ... } ],
    "pagination": {
      "currentPage": 0,
      "totalPages": 5,
      "totalElements": 95,
      "pageSize": 20,
      "hasNext": true,
      "hasPrevious": false
    }
  },
  "timestamp": "2026-02-10T10:30:00Z"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "EVENT_NOT_FOUND",
    "message": "Event with ID 550e8400-... not found",
    "details": null,
    "timestamp": "2026-02-10T10:30:00Z",
    "path": "/api/v1/events/550e8400-...",
    "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
  }
}
```

**Validation Error Response** (400):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed",
    "details": [
      { "field": "title", "message": "Title is required", "rejectedValue": null },
      { "field": "startTime", "message": "Start time must be in the future", "rejectedValue": "2025-01-01T00:00:00Z" }
    ],
    "timestamp": "2026-02-10T10:30:00Z",
    "path": "/api/v1/events"
  }
}
```

## 1.6. HTTP Status Codes

| Code | Usage | Example |
|------|-------|---------|
| `200 OK` | GET, PUT, PATCH success | Get event details |
| `201 Created` | POST success (resource created) | Create new event |
| `204 No Content` | DELETE success | Delete event |
| `400 Bad Request` | Validation error | Invalid input |
| `401 Unauthorized` | Missing/invalid token | Not logged in |
| `403 Forbidden` | Insufficient role | BUYER creating event |
| `404 Not Found` | Resource not found | Event ID invalid |
| `409 Conflict` | Business conflict | Tickets sold out |
| `422 Unprocessable Entity` | Semantic error | Event date in the past |
| `429 Too Many Requests` | Rate limit exceeded | Flash sale abuse |
| `500 Internal Server Error` | Server error | Database down |

## 1.7. Pagination

**Query Parameters**:
```
GET /api/v1/events?page=0&size=20&sort=startDatetime,asc
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | int | `0` | Zero-based page number |
| `size` | int | `20` | Items per page (max: 100) |
| `sort` | string | varies | Format: `field,direction` |

## 1.8. Filtering & Search

```
GET /api/v1/events?search=rock+concert&categorySlug=am-nhac&city=TP.HCM&minPrice=100000&maxPrice=1000000&startDate=2026-03-01
```

| Convention | Format | Example |
|-----------|--------|---------|
| Full-text search | `search=term` | `search=rock concert` |
| Exact match | `field=value` | `city=Hà Nội` |
| Range | `minField` / `maxField` | `minPrice=100000` |
| Multiple values | `field=v1,v2` (OR) | `status=PUBLISHED,SOLD_OUT` |
| Date range | ISO 8601 | `startDate=2026-03-01` |

---

# PART 2: User Service APIs

**Service**: User Service (Port 8081)  
**Database**: MongoDB  
**Base Path**: `/api/v1/users`  
**Responsibilities**: User profiles, Organizer profiles, Keycloak sync

---

## 2.1. Get Current User Profile

```http
GET /api/v1/users/me
```

**Auth**: Required (BUYER, ORGANIZER, ADMIN)

**Response 200**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "keycloakId": "550e8400-e29b-41d4-a716-446655440001",
    "email": "buyer@ticketbox.vn",
    "emailVerified": true,
    "phone": "+84901234567",
    "phoneVerified": false,
    "profile": {
      "firstName": "Văn A",
      "lastName": "Nguyễn",
      "displayName": "Nguyễn Văn A",
      "avatarUrl": null,
      "dateOfBirth": "1995-05-15",
      "gender": "male",
      "bio": "Yêu âm nhạc và các sự kiện live"
    },
    "roles": ["CUSTOMER"],
    "status": "ACTIVE",
    "preferences": {
      "language": "vi",
      "timezone": "Asia/Ho_Chi_Minh",
      "currency": "VND",
      "notifications": {
        "email": true,
        "sms": false,
        "push": true,
        "marketing": false
      },
      "favoriteCategories": []
    },
    "organizerProfileId": null,
    "lastLoginAt": "2026-02-10T08:00:00Z",
    "createdAt": "2026-01-15T08:30:00Z",
    "updatedAt": "2026-02-10T10:00:00Z"
  }
}
```

**Errors**: `401` Token missing/invalid

---

## 2.2. Update Current User Profile

```http
PATCH /api/v1/users/me
```

**Auth**: Required (All roles)

**Request Body**:
```json
{
  "profile": {
    "firstName": "Văn B",
    "lastName": "Nguyễn",
    "displayName": "Nguyễn Văn B",
    "avatarUrl": "https://cdn.example.com/avatars/new.jpg",
    "bio": "Updated bio"
  },
  "phone": "+84907654321",
  "preferences": {
    "language": "en",
    "notifications": {
      "sms": true
    }
  }
}
```

**Validation**:
- `phone`: Regex `^\+?[0-9]{10,15}$`
- `profile.firstName`, `profile.lastName`: Max 100 chars
- `profile.displayName`: Max 200 chars
- `profile.bio`: Max 500 chars
- `profile.avatarUrl`: Valid URL, max 500 chars

**Response 200**: Updated user object (same schema as GET /me)

**Errors**: `400` Validation error, `401` Unauthorized

---

## 2.3. Get Organizer Profile (Public)

```http
GET /api/v1/users/organizers/{organizerId}
```

**Auth**: Optional (Public API)

**Path Params**: `organizerId` (string, UUID)

**Response 200**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "userId": "550e8400-e29b-41d4-a716-446655440002",
    "organizerName": "ABC Entertainment",
    "organizerSlug": "abc-entertainment",
    "organizerType": "company",
    "description": "Công ty tổ chức sự kiện âm nhạc và giải trí hàng đầu Việt Nam",
    "branding": {
      "logoUrl": "https://cdn.example.com/logos/abc.png",
      "bannerUrl": "https://cdn.example.com/banners/abc.jpg",
      "primaryColor": "#FF5733",
      "websiteUrl": "https://abc-entertainment.vn"
    },
    "contact": {
      "email": "contact@abc-entertainment.vn",
      "phone": "+84909876543"
    },
    "socialLinks": {
      "facebook": "https://fb.com/abcent",
      "instagram": "@abcent"
    },
    "verification": {
      "isVerified": true,
      "verifiedAt": "2026-01-20T00:00:00Z"
    },
    "statistics": {
      "totalEvents": 45,
      "totalTicketsSold": 12500,
      "averageRating": 4.8,
      "followerCount": 3200
    },
    "createdAt": "2025-06-15T00:00:00Z"
  }
}
```

**Errors**: `404` Organizer not found

---

## 2.4. Get My Organizer Profile

```http
GET /api/v1/users/organizers/me
```

**Auth**: Required (ORGANIZER)

**Response 200**: Full organizer profile (including `bankAccount`, `businessInfo`)

**Errors**: `401`, `403` Not an organizer, `404` Profile not found

---

## 2.5. Update Organizer Profile

```http
PUT /api/v1/users/organizers/me
```

**Auth**: Required (ORGANIZER)

**Request Body**:
```json
{
  "organizerName": "ABC Entertainment Updated",
  "description": "Updated description...",
  "branding": {
    "logoUrl": "https://cdn.example.com/logos/new-abc.png",
    "bannerUrl": "https://cdn.example.com/banners/new-abc.jpg",
    "primaryColor": "#4ECDC4",
    "websiteUrl": "https://abc-entertainment.vn"
  },
  "contact": {
    "email": "new-contact@abc.vn",
    "phone": "+84909876543",
    "address": "123 Nguyễn Huệ, Quận 1, TP.HCM"
  },
  "socialLinks": {
    "facebook": "https://fb.com/abcent",
    "instagram": "@abcent_official"
  }
}
```

**Validation**:
- `organizerName`: Required, max 200 chars
- `description`: Max 2000 chars

**Response 200**: Updated organizer profile

---

## 2.6. Register as Organizer

```http
POST /api/v1/users/organizers/register
```

**Auth**: Required (CUSTOMER — will gain ORGANIZER role)

**Request Body**:
```json
{
  "organizerName": "New Events Co.",
  "organizerType": "company",
  "description": "Event organizer description",
  "contact": {
    "email": "events@newco.vn",
    "phone": "+84901234567"
  },
  "businessInfo": {
    "taxCode": "0123456789",
    "businessLicense": "DK-12345",
    "representativeName": "Nguyễn Văn A",
    "representativeIdNumber": "079095001234"
  }
}
```

**Response 201**:
```json
{
  "success": true,
  "data": {
    "id": "new-organizer-uuid",
    "status": "PENDING",
    "message": "Profile submitted for review. An admin will verify your information."
  }
}
```

**Errors**: `400` Validation, `409` Already an organizer

---

## 2.7. User Service — Additional Endpoints Summary

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/users/admin/list` | List all users (paginated) | ADMIN |
| PATCH | `/api/v1/users/admin/{userId}/status` | Change user status | ADMIN |
| GET | `/api/v1/users/admin/organizers` | List organizer profiles | ADMIN |
| PATCH | `/api/v1/users/admin/organizers/{id}/verify` | Verify/reject organizer | ADMIN |

---

# PART 3: Core Service APIs — Events Module

**Service**: Core Service (Port 8082)  
**Database**: PostgreSQL (`event_schema`)  
**Base Path**: `/api/v1/events`, `/api/v1/categories`, `/api/v1/venues`

---

## 3.1. Search & List Events (Public)

```http
GET /api/v1/events
```

**Auth**: Optional (Public)

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `search` | string | — | Full-text search (title, shortDescription) |
| `categorySlug` | string | — | Filter by category slug |
| `city` | string | — | Filter by venue city |
| `status` | enum | `PUBLISHED` | `DRAFT`, `PUBLISHED`, `CANCELLED`, `COMPLETED`, `SOLD_OUT` |
| `startDate` | date | — | Events starting from (ISO 8601) |
| `endDate` | date | — | Events ending before |
| `minPrice` | number | — | Min ticket price (VND) |
| `maxPrice` | number | — | Max ticket price (VND) |
| `featured` | boolean | — | Only featured events |
| `organizerId` | uuid | — | Filter by organizer |
| `page` | int | `0` | Page number |
| `size` | int | `20` | Page size (max 100) |
| `sort` | string | `startDatetime,asc` | Sort field |

**Example**:
```
GET /api/v1/events?search=rock&city=TP.HCM&startDate=2026-03-01&page=0&size=12&sort=startDatetime,asc
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "title": "Rock Storm 2026",
        "slug": "rock-storm-2026",
        "shortDescription": "Đại nhạc hội Rock lớn nhất năm",
        "bannerUrl": "https://cdn.example.com/events/rock-storm-banner.jpg",
        "thumbnailUrl": "https://cdn.example.com/events/rock-storm-thumb.jpg",
        "category": {
          "id": "cat-uuid-1",
          "name": "Âm nhạc",
          "slug": "am-nhac"
        },
        "venue": {
          "id": "venue-uuid-1",
          "name": "Sân vận động Mỹ Đình",
          "city": "Hà Nội"
        },
        "startDatetime": "2026-03-15T19:00:00+07:00",
        "endDatetime": "2026-03-15T23:00:00+07:00",
        "organizer": {
          "id": "550e8400-e29b-41d4-a716-446655440002",
          "name": "ABC Entertainment",
          "logoUrl": "https://cdn.example.com/logos/abc.png"
        },
        "ticketSummary": {
          "minPrice": 500000,
          "maxPrice": 1500000,
          "currency": "VND",
          "totalCapacity": 40000,
          "availableTickets": 35200,
          "soldOut": false
        },
        "status": "PUBLISHED",
        "isFeatured": true,
        "tags": ["rock", "music", "outdoor"]
      }
    ],
    "pagination": {
      "currentPage": 0,
      "totalPages": 3,
      "totalElements": 28,
      "pageSize": 12,
      "hasNext": true,
      "hasPrevious": false
    }
  }
}
```

---

## 3.2. Get Featured Events

```http
GET /api/v1/events/featured
```

**Auth**: Optional (Public)

**Query Params**: `size` (int, default 8)

**Response 200**: Array of event summary objects (same as listing item above)

---

## 3.3. Get Event Details

```http
GET /api/v1/events/{eventIdOrSlug}
```

**Auth**: Optional (Public)

**Path Params**: `eventIdOrSlug` — UUID or slug string

**Response 200**:
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "Rock Storm 2026",
    "slug": "rock-storm-2026",
    "description": "<p>Đại nhạc hội Rock lớn nhất năm 2026 với sự tham gia của các ban nhạc hàng đầu...</p>",
    "shortDescription": "Đại nhạc hội Rock lớn nhất năm",
    "tags": ["rock", "music", "outdoor"],
    "images": [
      { "id": "img-1", "url": "https://cdn.example.com/events/banner.jpg", "type": "BANNER", "isPrimary": true },
      { "id": "img-2", "url": "https://cdn.example.com/events/poster.jpg", "type": "POSTER", "isPrimary": false }
    ],
    "categories": [
      { "id": "cat-uuid-1", "name": "Âm nhạc", "slug": "am-nhac", "isPrimary": true },
      { "id": "cat-uuid-2", "name": "Rock", "slug": "rock", "isPrimary": false }
    ],
    "venue": {
      "id": "venue-uuid-1",
      "name": "Sân vận động Mỹ Đình",
      "slug": "svd-my-dinh",
      "address": "Lê Đức Thọ, Nam Từ Liêm",
      "city": "Hà Nội",
      "latitude": 21.02888,
      "longitude": 105.85139,
      "totalCapacity": 40000,
      "facilities": ["Wifi", "Parking", "Food Court"]
    },
    "schedule": {
      "startDatetime": "2026-03-15T19:00:00+07:00",
      "endDatetime": "2026-03-15T23:00:00+07:00",
      "timezone": "Asia/Ho_Chi_Minh",
      "saleStartDatetime": "2026-02-01T00:00:00+07:00",
      "saleEndDatetime": "2026-03-15T18:00:00+07:00"
    },
    "organizer": {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "name": "ABC Entertainment",
      "logoUrl": "https://cdn.example.com/logos/abc.png",
      "isVerified": true
    },
    "ticketTypes": [
      {
        "id": "tt-uuid-1",
        "name": "VIP",
        "description": "Ghế VIP gần sân khấu, quà tặng kèm",
        "price": 1500000,
        "originalPrice": 1800000,
        "currency": "VND",
        "quantityTotal": 500,
        "quantityAvailable": 120,
        "maxPerOrder": 4,
        "saleStartDatetime": "2026-02-01T00:00:00+07:00",
        "saleEndDatetime": "2026-03-15T18:00:00+07:00",
        "seatSelectionEnabled": false,
        "status": "ACTIVE",
        "colorCode": "#FFE66D",
        "displayOrder": 1
      },
      {
        "id": "tt-uuid-2",
        "name": "Regular",
        "description": "Vé thường — khu đứng",
        "price": 500000,
        "originalPrice": null,
        "currency": "VND",
        "quantityTotal": 10000,
        "quantityAvailable": 8500,
        "maxPerOrder": 10,
        "saleStartDatetime": "2026-02-01T00:00:00+07:00",
        "saleEndDatetime": "2026-03-15T18:00:00+07:00",
        "seatSelectionEnabled": false,
        "status": "ACTIVE",
        "colorCode": "#95E1D3",
        "displayOrder": 2
      }
    ],
    "config": {
      "minTicketsPerOrder": 1,
      "maxTicketsPerOrder": 10,
      "visibility": "PUBLIC"
    },
    "statistics": {
      "viewCount": 15420,
      "ticketsSold": 1880,
      "totalCapacity": 10500
    },
    "status": "PUBLISHED",
    "isFeatured": true,
    "createdAt": "2026-01-20T10:00:00+07:00",
    "updatedAt": "2026-02-10T09:15:00+07:00"
  }
}
```

**Errors**: `404` Event not found, `410` Event soft-deleted

---

## 3.4. Create Event (Organizer)

```http
POST /api/v1/events
```

**Auth**: Required (ORGANIZER, ADMIN)

**Request Body**:
```json
{
  "title": "Rock Storm 2026",
  "shortDescription": "Đại nhạc hội Rock lớn nhất năm",
  "description": "<p>Mô tả chi tiết HTML...</p>",
  "categoryIds": ["cat-uuid-1", "cat-uuid-2"],
  "primaryCategoryId": "cat-uuid-1",
  "venueId": "venue-uuid-1",
  "isOnline": false,
  "startDatetime": "2026-03-15T19:00:00+07:00",
  "endDatetime": "2026-03-15T23:00:00+07:00",
  "saleStartDatetime": "2026-02-01T00:00:00+07:00",
  "saleEndDatetime": "2026-03-15T18:00:00+07:00",
  "ticketTypes": [
    {
      "name": "VIP",
      "description": "Ghế VIP gần sân khấu",
      "price": 1500000,
      "quantityTotal": 500,
      "maxPerOrder": 4,
      "seatSelectionEnabled": false,
      "colorCode": "#FFE66D"
    },
    {
      "name": "Regular",
      "description": "Vé thường — khu đứng",
      "price": 500000,
      "quantityTotal": 10000,
      "maxPerOrder": 10,
      "seatSelectionEnabled": false,
      "colorCode": "#95E1D3"
    }
  ],
  "tags": ["rock", "music"],
  "minTicketsPerOrder": 1,
  "maxTicketsPerOrder": 10
}
```

**Validation Rules**:
| Field | Rule |
|-------|------|
| `title` | Required, 5–255 chars |
| `startDatetime` | Required, must be future |
| `endDatetime` | Required, must be after `startDatetime` |
| `ticketTypes` | At least 1 required |
| `ticketTypes[].price` | >= 0 |
| `ticketTypes[].quantityTotal` | > 0 |
| `categoryIds` | At least 1, max 5 |

**Response 201**:
```json
{
  "success": true,
  "data": {
    "id": "new-event-uuid",
    "slug": "rock-storm-2026",
    "status": "DRAFT"
  },
  "message": "Event created as DRAFT. Submit for publishing when ready."
}
```

**Errors**: `400` Validation, `403` Not ORGANIZER, `422` Venue conflict

---

## 3.5. Update Event

```http
PUT /api/v1/events/{eventId}
```

**Auth**: Required (ORGANIZER — owner only, ADMIN)

**Request Body**: Same as create (all fields optional, partial update)

**Response 200**: Updated event object

**Errors**: `403` Not owner, `404` Not found, `409` Cannot update published event with attendees

---

## 3.6. Change Event Status

```http
PATCH /api/v1/events/{eventId}/status
```

**Auth**: Required (ORGANIZER — owner, ADMIN)

**Request Body**:
```json
{
  "status": "PUBLISHED"
}
```

**Valid Transitions**:
```mermaid
stateDiagram-v2
    DRAFT --> PUBLISHED : Organizer publishes
    PUBLISHED --> CANCELLED : Organizer/Admin cancels
    PUBLISHED --> COMPLETED : Auto (after endDatetime)
    PUBLISHED --> SOLD_OUT : Auto (all tickets sold)
    CANCELLED --> DRAFT : Admin re-opens
```

**Errors**: `400` Invalid transition, `403` Not owner

---

## 3.7. Delete Event (Soft)

```http
DELETE /api/v1/events/{eventId}
```

**Auth**: Required (ORGANIZER — owner, ADMIN)

**Response 204**: No content

**Errors**: `403` Not owner, `409` Event has confirmed orders

---

## 3.8. Get Event Analytics

```http
GET /api/v1/events/{eventId}/analytics
```

**Auth**: Required (ORGANIZER — owner, ADMIN)

**Response 200**:
```json
{
  "success": true,
  "data": {
    "eventId": "event-uuid",
    "views": 15420,
    "totalRevenue": 450000000,
    "currency": "VND",
    "ticketsSold": 1880,
    "totalCapacity": 10500,
    "occupancyRate": 17.9,
    "salesByTicketType": [
      { "ticketTypeName": "VIP", "sold": 380, "total": 500, "revenue": 570000000 },
      { "ticketTypeName": "Regular", "sold": 1500, "total": 10000, "revenue": 750000000 }
    ],
    "salesByDate": [
      { "date": "2026-02-01", "count": 50, "revenue": 45000000 },
      { "date": "2026-02-02", "count": 120, "revenue": 95000000 }
    ]
  }
}
```

---

## 3.9. Categories API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/categories` | Public | List all active categories (hierarchical) |
| GET | `/api/v1/categories/{slug}` | Public | Get category by slug |
| GET | `/api/v1/categories/{slug}/events` | Public | Events in category (paginated) |
| POST | `/api/v1/admin/categories` | ADMIN | Create category |
| PUT | `/api/v1/admin/categories/{id}` | ADMIN | Update category |
| DELETE | `/api/v1/admin/categories/{id}` | ADMIN | Soft-delete category |

**GET /api/v1/categories Response 200**:
```json
{
  "success": true,
  "data": [
    {
      "id": "cat-uuid-1",
      "name": "Âm nhạc",
      "slug": "am-nhac",
      "description": "Các buổi biểu diễn âm nhạc, live show, concert",
      "iconUrl": null,
      "displayOrder": 1,
      "children": [
        { "id": "cat-uuid-1a", "name": "Nhạc trẻ", "slug": "nhac-tre", "displayOrder": 1 },
        { "id": "cat-uuid-1b", "name": "Rock", "slug": "rock", "displayOrder": 2 },
        { "id": "cat-uuid-1c", "name": "EDM", "slug": "edm", "displayOrder": 3 }
      ]
    },
    {
      "id": "cat-uuid-2",
      "name": "Sân khấu & Nghệ thuật",
      "slug": "san-khau-nghe-thuat",
      "displayOrder": 2,
      "children": []
    }
  ]
}
```

---

## 3.10. Venues API

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/venues` | Public | List venues (with search, city filter) |
| GET | `/api/v1/venues/{id}` | Public | Venue details (sectors, capacity) |
| POST | `/api/v1/admin/venues` | ADMIN | Create venue |
| PUT | `/api/v1/admin/venues/{id}` | ADMIN | Update venue |

---

# PART 4: Core Service APIs — Booking Module

**Database**: PostgreSQL (`booking_schema`)  
**Base Path**: `/api/v1/bookings`, `/api/v1/orders`, `/api/v1/tickets`  
**Responsibilities**: Reservations (Flash Sale), Orders, Tickets, QR Check-in

---

## 4.1. Flash Sale Booking Flow

```mermaid
sequenceDiagram
    participant Buyer
    participant FE as Frontend
    participant GW as API Gateway
    participant CS as Core Service
    participant Redis
    participant PG as PostgreSQL

    Buyer->>FE: Click "Mua vé"
    FE->>GW: POST /api/v1/bookings/reserve
    GW->>CS: Forward
    CS->>Redis: Try acquire distributed lock (ticket_type_id)
    alt Lock acquired — tickets available
        Redis-->>CS: Lock granted
        CS->>PG: INSERT reservation (status=ACTIVE, expires_at=+15min)
        CS->>PG: UPDATE ticket_types SET quantity_available -= quantity
        CS->>Redis: Store reservation with TTL 15 min
        CS-->>FE: 201 Created (reservationId, expiresAt)
        FE->>Buyer: Show checkout form + 15-min countdown

        Buyer->>FE: Fill info + click "Thanh toán"
        FE->>GW: POST /api/v1/bookings/confirm
        GW->>CS: Forward
        CS->>PG: INSERT order + order_items
        CS->>PG: UPDATE reservation SET status=CONVERTED
        CS->>Redis: Release lock
        CS-->>FE: 200 OK (orderId, paymentUrl)
        FE->>Buyer: Redirect to VNPay
    else Lock denied — sold out
        Redis-->>CS: Lock failed
        CS-->>FE: 409 Conflict (TICKET_SOLD_OUT)
        FE->>Buyer: "Đã hết vé!"
    end
```

---

## 4.2. Create Reservation (Step 1 — Hold Tickets)

```http
POST /api/v1/bookings/reserve
```

**Auth**: Required (CUSTOMER, ORGANIZER)  
**Rate Limit**: 3 requests/user/minute

**Request Body**:
```json
{
  "eventId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "items": [
    { "ticketTypeId": "tt-uuid-1", "quantity": 2 },
    { "ticketTypeId": "tt-uuid-2", "quantity": 1 }
  ],
  "promoCode": "WELCOME2026"
}
```

**Response 201**:
```json
{
  "success": true,
  "data": {
    "reservationId": "res-uuid-1",
    "eventId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "items": [
      {
        "ticketTypeId": "tt-uuid-1",
        "ticketTypeName": "VIP",
        "quantity": 2,
        "unitPrice": 1500000,
        "subtotal": 3000000
      },
      {
        "ticketTypeId": "tt-uuid-2",
        "ticketTypeName": "Regular",
        "quantity": 1,
        "unitPrice": 500000,
        "subtotal": 500000
      }
    ],
    "pricing": {
      "subtotal": 3500000,
      "discount": 100000,
      "total": 3400000,
      "currency": "VND"
    },
    "promoApplied": {
      "code": "WELCOME2026",
      "discountType": "PERCENTAGE",
      "discountValue": 10,
      "discountAmount": 100000
    },
    "expiresAt": "2026-02-10T10:45:00+07:00",
    "remainingSeconds": 900
  },
  "message": "Vé đã được giữ. Hoàn tất thanh toán trong 15 phút."
}
```

**Errors**:
| Code | Status | Description |
|------|--------|-------------|
| `TICKET_SOLD_OUT` | 409 | Loại vé đã hết |
| `TICKET_INSUFFICIENT_QUANTITY` | 409 | Không đủ số lượng yêu cầu |
| `EVENT_SALES_NOT_STARTED` | 422 | Chưa mở bán |
| `EVENT_SALES_ENDED` | 422 | Đã hết hạn bán |
| `PROMO_CODE_INVALID` | 422 | Mã khuyến mãi không hợp lệ |
| `TOO_MANY_ACTIVE_RESERVATIONS` | 429 | User đang giữ quá nhiều vé |

---

## 4.3. Confirm Booking (Step 2 — Create Order)

```http
POST /api/v1/bookings/confirm
```

**Auth**: Required (CUSTOMER, ORGANIZER)

**Request Body**:
```json
{
  "reservationId": "res-uuid-1",
  "paymentMethod": "VNPAY",
  "customerInfo": {
    "fullName": "Nguyễn Văn A",
    "email": "buyer@ticketbox.vn",
    "phone": "+84901234567"
  },
  "returnUrl": "http://localhost:5173/payment/result"
}
```

**Response 200** (redirect to payment):
```json
{
  "success": true,
  "data": {
    "orderId": "ord-uuid-1",
    "orderNumber": "ORD-20260210-A1B2C3D4",
    "totalAmount": 3400000,
    "currency": "VND",
    "paymentMethod": "VNPAY",
    "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=340000000&vnp_TxnRef=ORD-20260210-A1B2C3D4&...",
    "paymentExpiresAt": "2026-02-10T10:50:00+07:00",
    "status": "PENDING"
  },
  "message": "Đang chuyển đến cổng thanh toán..."
}
```

**Response 200** (free event — instant confirmation):
```json
{
  "success": true,
  "data": {
    "orderId": "ord-uuid-1",
    "orderNumber": "ORD-20260210-A1B2C3D4",
    "totalAmount": 0,
    "status": "CONFIRMED",
    "tickets": [
      {
        "ticketId": "tkt-uuid-1",
        "ticketCode": "TKT-A1B2C3D4-F9E8",
        "ticketTypeName": "Free Pass",
        "qrCodeUrl": "/api/v1/tickets/tkt-uuid-1/qr"
      }
    ]
  },
  "message": "Đặt vé thành công!"
}
```

**Errors**: `404` Reservation not found, `422 RESERVATION_EXPIRED` Hold đã hết hạn, `400` Invalid customer info

---

## 4.4. Cancel Reservation

```http
DELETE /api/v1/bookings/reservations/{reservationId}
```

**Auth**: Required (CUSTOMER — owner)

**Response 204**: No content (tickets released back to pool)

---

## 4.5. Get My Orders

```http
GET /api/v1/orders/me
```

**Auth**: Required (CUSTOMER, ORGANIZER)

**Query Params**: `status` (PENDING | CONFIRMED | CANCELLED | REFUNDED | EXPIRED), `page`, `size`, `sort`

**Response 200**:
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "orderId": "ord-uuid-1",
        "orderNumber": "ORD-20260210-A1B2C3D4",
        "event": {
          "id": "event-uuid",
          "title": "Rock Storm 2026",
          "thumbnailUrl": "https://cdn.example.com/thumb.jpg",
          "startDatetime": "2026-03-15T19:00:00+07:00",
          "venueName": "Sân vận động Mỹ Đình"
        },
        "items": [
          { "ticketTypeName": "VIP", "quantity": 2, "unitPrice": 1500000, "subtotal": 3000000 },
          { "ticketTypeName": "Regular", "quantity": 1, "unitPrice": 500000, "subtotal": 500000 }
        ],
        "totalAmount": 3400000,
        "currency": "VND",
        "paymentMethod": "VNPAY",
        "paymentStatus": "SUCCESS",
        "status": "CONFIRMED",
        "createdAt": "2026-02-10T10:30:00+07:00"
      }
    ],
    "pagination": { "currentPage": 0, "totalPages": 2, "totalElements": 15, "pageSize": 10, "hasNext": true, "hasPrevious": false }
  }
}
```

---

## 4.6. Get Order Details

```http
GET /api/v1/orders/{orderId}
```

**Auth**: Required (CUSTOMER — owner, ADMIN)

**Response 200**: Full order object with items, payment details, tickets list

---

## 4.7. Cancel Order & Request Refund

```http
POST /api/v1/orders/{orderId}/cancel
```

**Auth**: Required (CUSTOMER — owner)

**Request Body**:
```json
{
  "reason": "Không thể tham dự do lịch công tác"
}
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "orderId": "ord-uuid-1",
    "status": "CANCELLED",
    "refundStatus": "PENDING",
    "refundAmount": 3400000,
    "estimatedRefundDate": "2026-02-17T00:00:00+07:00"
  },
  "message": "Đơn hàng đã được hủy. Tiền sẽ được hoàn trong 5-7 ngày làm việc."
}
```

**Errors**: `409` Order already cancelled, `422` Cannot cancel — event already started

---

## 4.8. Get My Tickets

```http
GET /api/v1/tickets/me
```

**Auth**: Required (CUSTOMER, ORGANIZER)

**Query Params**: `status` (VALID | USED | CANCELLED), `upcoming` (boolean), `page`, `size`

**Response 200**:
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "ticketId": "tkt-uuid-1",
        "ticketCode": "TKT-A1B2C3D4-F9E8",
        "event": {
          "id": "event-uuid",
          "title": "Rock Storm 2026",
          "startDatetime": "2026-03-15T19:00:00+07:00",
          "venueName": "Sân vận động Mỹ Đình",
          "venueAddress": "Lê Đức Thọ, Nam Từ Liêm, Hà Nội"
        },
        "ticketTypeName": "VIP",
        "seatLabel": null,
        "holderName": "Nguyễn Văn A",
        "price": 1500000,
        "currency": "VND",
        "qrCodeUrl": "/api/v1/tickets/tkt-uuid-1/qr",
        "status": "VALID",
        "checkedInAt": null,
        "orderNumber": "ORD-20260210-A1B2C3D4"
      }
    ],
    "pagination": { "currentPage": 0, "totalPages": 1, "totalElements": 3, "pageSize": 20, "hasNext": false, "hasPrevious": false }
  }
}
```

---

## 4.9. Get Ticket QR Code

```http
GET /api/v1/tickets/{ticketId}/qr
```

**Auth**: Required (CUSTOMER — owner)

**Response 200**: `image/png` (QR code image)

**QR Code Data** (encoded in QR):
```json
{
  "ticketId": "tkt-uuid-1",
  "ticketCode": "TKT-A1B2C3D4-F9E8",
  "eventId": "event-uuid",
  "checksum": "sha256-hash-for-validation"
}
```

---

## 4.10. Check-in Ticket (Scan QR)

```http
POST /api/v1/tickets/{ticketId}/check-in
```

**Auth**: Required (ORGANIZER — event owner)

**Request Body**:
```json
{
  "ticketCode": "TKT-A1B2C3D4-F9E8",
  "checkInLocation": "Cổng A"
}
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "ticketId": "tkt-uuid-1",
    "ticketCode": "TKT-A1B2C3D4-F9E8",
    "holderName": "Nguyễn Văn A",
    "ticketTypeName": "VIP",
    "eventTitle": "Rock Storm 2026",
    "status": "USED",
    "checkedInAt": "2026-03-15T18:45:00+07:00",
    "checkedInBy": "550e8400-e29b-41d4-a716-446655440002"
  },
  "message": "Check-in thành công!"
}
```

**Errors**:
| Code | Status | Description |
|------|--------|-------------|
| `TICKET_ALREADY_USED` | 409 | Vé đã được check-in trước đó |
| `TICKET_CANCELLED` | 422 | Vé đã bị hủy |
| `TICKET_INVALID` | 404 | Mã vé không hợp lệ |
| `EVENT_NOT_OWNED` | 403 | Organizer không sở hữu event này |

---

# PART 5: Core Service APIs — Payment Module

**Database**: PostgreSQL (`payment_schema`)  
**Base Path**: `/api/v1/payments`  
**Integration**: VNPay payment gateway

---

## 5.1. Create Payment URL

```http
POST /api/v1/payments/create-url
```

**Auth**: Required (CUSTOMER)

**Request Body**:
```json
{
  "orderId": "ord-uuid-1",
  "paymentMethod": "VNPAY",
  "bankCode": "NCB",
  "language": "vn",
  "returnUrl": "http://localhost:5173/payment/result"
}
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "paymentUrl": "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=340000000&vnp_BankCode=NCB&vnp_Command=pay&vnp_CreateDate=20260210103000&vnp_CurrCode=VND&vnp_IpAddr=127.0.0.1&vnp_Locale=vn&vnp_OrderInfo=Thanh+toan+don+hang+ORD-20260210-A1B2C3D4&vnp_OrderType=billpayment&vnp_ReturnUrl=http%3A%2F%2Flocalhost%3A5173%2Fpayment%2Fresult&vnp_TmnCode=DEMO_TMN&vnp_TxnRef=TXN-20260210-B2C3D4E5&vnp_Version=2.1.0&vnp_SecureHash=abc123...",
    "transactionNumber": "TXN-20260210-B2C3D4E5",
    "expiresAt": "2026-02-10T10:45:00+07:00"
  }
}
```

---

## 5.2. VNPay Return URL Handler

```http
GET /api/v1/payments/vnpay-return?vnp_Amount=340000000&vnp_BankCode=NCB&vnp_ResponseCode=00&vnp_TxnRef=TXN-20260210-B2C3D4E5&vnp_SecureHash=...
```

**Auth**: None (public — VNPay redirects here)

**Behavior**: Validates `vnp_SecureHash`, updates transaction status, redirects to frontend with result.

**Redirect**: `http://localhost:5173/payment/result?orderId=ord-uuid-1&status=SUCCESS`

---

## 5.3. VNPay IPN Webhook (Server-to-Server)

```http
POST /api/v1/payments/vnpay-ipn
```

**Auth**: None (IP whitelist from VNPay)

**Behavior**:
1. Verify `vnp_SecureHash` with secret key
2. Update `payment_schema.transactions` status
3. If payment SUCCESS → update `booking_schema.orders` status to CONFIRMED
4. Issue tickets → INSERT into `booking_schema.tickets` with QR codes
5. Respond to VNPay with `{"RspCode": "00", "Message": "Confirm Success"}`

---

## 5.4. Get Payment Status

```http
GET /api/v1/payments/{orderId}/status
```

**Auth**: Required (CUSTOMER — owner)

**Response 200**:
```json
{
  "success": true,
  "data": {
    "orderId": "ord-uuid-1",
    "orderNumber": "ORD-20260210-A1B2C3D4",
    "transactionNumber": "TXN-20260210-B2C3D4E5",
    "amount": 3400000,
    "currency": "VND",
    "paymentMethod": "VNPAY",
    "bankCode": "NCB",
    "status": "SUCCESS",
    "paidAt": "2026-02-10T10:35:00+07:00",
    "providerResponseCode": "00",
    "providerMessage": "Giao dịch thành công"
  }
}
```

**Payment Status Values**: `PENDING`, `SUCCESS`, `FAILED`, `CANCELLED`, `REFUNDED`

---

## 5.5. Request Refund

```http
POST /api/v1/payments/{orderId}/refund
```

**Auth**: Required (CUSTOMER — owner, ADMIN)

**Request Body**:
```json
{
  "reason": "Event bị hủy bởi Ban tổ chức",
  "refundType": "FULL",
  "refundAmount": 3400000
}
```

**Response 201**:
```json
{
  "success": true,
  "data": {
    "refundId": "ref-uuid-1",
    "orderId": "ord-uuid-1",
    "refundAmount": 3400000,
    "refundType": "FULL",
    "status": "PENDING",
    "estimatedCompletionDate": "2026-02-17"
  },
  "message": "Yêu cầu hoàn tiền đã được ghi nhận."
}
```

---

# PART 6: Core Service APIs — Promotion Module

**Database**: PostgreSQL (`promotion_schema`)  
**Base Path**: `/api/v1/promotions`

---

## 6.1. Validate Promo Code

```http
POST /api/v1/promotions/validate
```

**Auth**: Required (CUSTOMER)

**Request Body**:
```json
{
  "code": "WELCOME2026",
  "eventId": "event-uuid",
  "orderAmount": 3500000
}
```

**Response 200** (valid):
```json
{
  "success": true,
  "data": {
    "valid": true,
    "code": "WELCOME2026",
    "name": "Chào mừng 2026",
    "discountType": "PERCENTAGE",
    "discountValue": 10,
    "calculatedDiscount": 100000,
    "maxDiscount": 100000,
    "finalAmount": 3400000,
    "currency": "VND",
    "message": "Giảm 10% (tối đa 100.000₫)"
  }
}
```

**Response 200** (invalid):
```json
{
  "success": true,
  "data": {
    "valid": false,
    "code": "EXPIRED2025",
    "reason": "PROMO_EXPIRED",
    "message": "Mã khuyến mãi đã hết hạn"
  }
}
```

**Invalid Reasons**: `PROMO_NOT_FOUND`, `PROMO_EXPIRED`, `PROMO_MAX_USES_REACHED`, `PROMO_ALREADY_USED_BY_USER`, `PROMO_MIN_ORDER_NOT_MET`, `PROMO_NOT_APPLICABLE_TO_EVENT`

---

## 6.2. Admin — Manage Promotions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/admin/promotions` | ADMIN | List all promotions (paginated) |
| POST | `/api/v1/admin/promotions` | ADMIN | Create promotion |
| PUT | `/api/v1/admin/promotions/{id}` | ADMIN | Update promotion |
| PATCH | `/api/v1/admin/promotions/{id}/status` | ADMIN | Activate/pause/expire |
| GET | `/api/v1/admin/promotions/{id}/usage` | ADMIN | View usage statistics |

---

# PART 7: Admin & Dashboard APIs

---

## 7.1. Admin Dashboard Overview

```http
GET /api/v1/admin/dashboard
```

**Auth**: Required (ADMIN)

**Response 200**:
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 12450,
      "totalOrganizers": 85,
      "totalEvents": 320,
      "activeEvents": 45,
      "totalOrders": 8900,
      "totalRevenue": 2500000000,
      "currency": "VND"
    },
    "recentActivity": {
      "newUsersToday": 32,
      "ordersToday": 120,
      "revenueToday": 85000000
    },
    "pendingActions": {
      "pendingOrganizerVerifications": 3,
      "pendingRefunds": 7,
      "reportedEvents": 1
    }
  }
}
```

---

## 7.2. Admin — User Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/admin/users` | ADMIN | List users (paginated, searchable) |
| GET | `/api/v1/admin/users/{userId}` | ADMIN | Get user details |
| PATCH | `/api/v1/admin/users/{userId}/status` | ADMIN | Suspend/activate user |
| GET | `/api/v1/admin/users/{userId}/orders` | ADMIN | View user's order history |

**PATCH Status Request**:
```json
{
  "status": "SUSPENDED",
  "reason": "Vi phạm điều khoản sử dụng"
}
```

**Valid User Statuses**: `ACTIVE`, `INACTIVE`, `SUSPENDED`, `PENDING_VERIFICATION`

---

## 7.3. Admin — Event Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/admin/events` | ADMIN | List all events (all statuses) |
| GET | `/api/v1/admin/events/{eventId}` | ADMIN | Get event with admin details |
| PATCH | `/api/v1/admin/events/{eventId}/status` | ADMIN | Force status change |
| DELETE | `/api/v1/admin/events/{eventId}` | ADMIN | Force delete event |

---

## 7.4. Admin — Order & Refund Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/admin/orders` | ADMIN | List all orders (filterable) |
| GET | `/api/v1/admin/orders/{orderId}` | ADMIN | Full order details |
| GET | `/api/v1/admin/refunds` | ADMIN | List pending refunds |
| PATCH | `/api/v1/admin/refunds/{refundId}` | ADMIN | Approve/reject refund |

**Approve Refund Request**:
```json
{
  "action": "APPROVE",
  "adminNote": "Đã xác nhận hoàn tiền"
}
```

---

## 7.5. Admin — System Health

```http
GET /api/v1/admin/health
```

**Auth**: Required (ADMIN)

**Response 200**:
```json
{
  "success": true,
  "data": {
    "status": "UP",
    "services": {
      "coreService": { "status": "UP", "responseTime": "12ms" },
      "userService": { "status": "UP", "responseTime": "8ms" },
      "postgresql": { "status": "UP", "responseTime": "3ms" },
      "mongodb": { "status": "UP", "responseTime": "5ms" },
      "redis": { "status": "UP", "responseTime": "1ms" },
      "keycloak": { "status": "UP", "responseTime": "15ms" }
    },
    "uptime": "72h 15m 30s",
    "timestamp": "2026-02-10T10:30:00Z"
  }
}
```

---

## 7.6. Organizer Dashboard

```http
GET /api/v1/organizers/me/dashboard
```

**Auth**: Required (ORGANIZER)

**Response 200**:
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalEvents": 12,
      "activeEvents": 3,
      "totalTicketsSold": 4500,
      "totalRevenue": 850000000,
      "currency": "VND",
      "averageOccupancy": 78.5
    },
    "upcomingEvents": [
      {
        "id": "event-uuid-1",
        "title": "Rock Storm 2026",
        "startDatetime": "2026-03-15T19:00:00+07:00",
        "ticketsSold": 1880,
        "totalCapacity": 10500,
        "revenue": 450000000,
        "status": "PUBLISHED"
      }
    ],
    "recentOrders": [
      {
        "orderNumber": "ORD-20260210-A1B2C3D4",
        "eventTitle": "Rock Storm 2026",
        "amount": 3400000,
        "status": "CONFIRMED",
        "createdAt": "2026-02-10T10:30:00+07:00"
      }
    ],
    "salesTrend": [
      { "date": "2026-02-04", "tickets": 45, "revenue": 35000000 },
      { "date": "2026-02-05", "tickets": 52, "revenue": 41000000 },
      { "date": "2026-02-06", "tickets": 38, "revenue": 28000000 }
    ]
  }
}
```

---

## 7.7. Organizer — Event Orders

```http
GET /api/v1/organizers/me/events/{eventId}/orders
```

**Auth**: Required (ORGANIZER — event owner)

**Query Params**: `status`, `startDate`, `endDate`, `page`, `size`, `sort`

**Response 200**: Paginated order list for this event (same schema as My Orders but with buyer info visible)

---

## 7.8. Organizer — Event Check-in Summary

```http
GET /api/v1/organizers/me/events/{eventId}/check-in-summary
```

**Auth**: Required (ORGANIZER — event owner)

**Response 200**:
```json
{
  "success": true,
  "data": {
    "eventId": "event-uuid",
    "eventTitle": "Rock Storm 2026",
    "totalTickets": 1880,
    "checkedIn": 1245,
    "remaining": 635,
    "checkInRate": 66.2,
    "byTicketType": [
      { "name": "VIP", "total": 380, "checkedIn": 310, "rate": 81.6 },
      { "name": "Regular", "total": 1500, "checkedIn": 935, "rate": 62.3 }
    ],
    "lastCheckInAt": "2026-03-15T19:30:00+07:00"
  }
}
```

---

# PART 8: Error Handling & Error Codes

> [!TIP]
> Tất cả error codes đều là **UPPER_SNAKE_CASE** và có prefix theo module. Frontend nên dùng `error.code` để hiển thị message phù hợp cho user.

---

## 8.1. Error Response Structure

Mọi lỗi đều trả về cùng structure:

```json
{
  "success": false,
  "error": {
    "code": "MODULE_SPECIFIC_ERROR_CODE",
    "message": "Human-readable description (tiếng Việt hoặc English)",
    "details": null,
    "timestamp": "2026-02-10T10:30:00Z",
    "path": "/api/v1/resource",
    "requestId": "uuid-for-tracing"
  }
}
```

**`details` field** — chỉ xuất hiện khi có thêm context:
- **Validation errors**: Array of `{ field, message, rejectedValue }`
- **Business errors**: Object with domain-specific info (e.g. `{ availableQuantity: 5 }`)

---

## 8.2. General Error Codes (All modules)

| Code | HTTP Status | Description | Frontend Action |
|------|-------------|-------------|-----------------|
| `VALIDATION_ERROR` | 400 | Input không hợp lệ | Hiển thị lỗi từng field |
| `UNAUTHORIZED` | 401 | Token thiếu hoặc hết hạn | Redirect → login |
| `FORBIDDEN` | 403 | Không đủ quyền (role) | Hiện "Bạn không có quyền" |
| `RESOURCE_NOT_FOUND` | 404 | Tài nguyên không tồn tại | Hiện trang 404 |
| `METHOD_NOT_ALLOWED` | 405 | HTTP method sai | - |
| `INTERNAL_SERVER_ERROR` | 500 | Lỗi server không xác định | Hiện "Có lỗi xảy ra, thử lại sau" |
| `SERVICE_UNAVAILABLE` | 503 | Service đang bảo trì | Hiện trang maintenance |
| `RATE_LIMIT_EXCEEDED` | 429 | Quá giới hạn request | Hiện countdown retry |

---

## 8.3. Authentication & User Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH_TOKEN_EXPIRED` | 401 | Access token hết hạn → dùng refresh token |
| `AUTH_TOKEN_INVALID` | 401 | Token không hợp lệ |
| `AUTH_REFRESH_FAILED` | 401 | Refresh token hết hạn → login lại |
| `USER_NOT_FOUND` | 404 | User ID không tồn tại |
| `USER_SUSPENDED` | 403 | Tài khoản bị khóa |
| `USER_ALREADY_ORGANIZER` | 409 | Đã đăng ký tổ chức rồi |
| `ORGANIZER_NOT_VERIFIED` | 403 | Chưa được admin xác minh |
| `ORGANIZER_NOT_FOUND` | 404 | Profile organizer không tồn tại |

---

## 8.4. Event Module Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `EVENT_NOT_FOUND` | 404 | Event không tồn tại hoặc đã bị xóa |
| `EVENT_NOT_PUBLISHED` | 422 | Event chưa được publish |
| `EVENT_CANCELLED` | 410 | Event đã bị hủy |
| `EVENT_COMPLETED` | 410 | Event đã kết thúc |
| `EVENT_NOT_OWNED` | 403 | Organizer không sở hữu event này |
| `EVENT_INVALID_STATUS_TRANSITION` | 400 | Chuyển trạng thái không hợp lệ (ví dụ DRAFT → COMPLETED) |
| `EVENT_HAS_ORDERS` | 409 | Không thể xóa event đã có orders |
| `EVENT_SLUG_DUPLICATE` | 409 | Slug đã tồn tại |
| `CATEGORY_NOT_FOUND` | 404 | Category không tồn tại |
| `VENUE_NOT_FOUND` | 404 | Venue không tồn tại |
| `VENUE_SCHEDULE_CONFLICT` | 409 | Venue đã có event khác cùng thời gian |

---

## 8.5. Booking & Flash Sale Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `TICKET_TYPE_NOT_FOUND` | 404 | Loại vé không tồn tại |
| `TICKET_SOLD_OUT` | 409 | Loại vé đã bán hết |
| `TICKET_INSUFFICIENT_QUANTITY` | 409 | Không đủ số vé yêu cầu. `details.available` = số còn lại |
| `TICKET_MAX_PER_ORDER_EXCEEDED` | 400 | Vượt giới hạn vé/đơn hàng |
| `EVENT_SALES_NOT_STARTED` | 422 | Chưa đến thời gian mở bán |
| `EVENT_SALES_ENDED` | 422 | Đã hết thời gian bán vé |
| `RESERVATION_NOT_FOUND` | 404 | Reservation không tồn tại |
| `RESERVATION_EXPIRED` | 422 | Hết hạn giữ vé — cần reserve lại |
| `RESERVATION_ALREADY_USED` | 409 | Reservation đã dùng để tạo order |
| `TOO_MANY_ACTIVE_RESERVATIONS` | 429 | User đang giữ quá nhiều reservation |
| `ORDER_NOT_FOUND` | 404 | Đơn hàng không tồn tại |
| `ORDER_ALREADY_CANCELLED` | 409 | Đơn đã bị hủy rồi |
| `ORDER_CANCEL_NOT_ALLOWED` | 422 | Không thể hủy (event đã diễn ra) |
| `TICKET_NOT_FOUND` | 404 | Vé không tồn tại |
| `TICKET_ALREADY_USED` | 409 | Vé đã check-in (đã sử dụng) |
| `TICKET_CANCELLED` | 422 | Vé đã bị hủy |
| `FLASH_SALE_LOCK_TIMEOUT` | 503 | Redis lock timeout — thử lại |
| `FLASH_SALE_QUEUE_FULL` | 429 | Hàng đợi flash sale đầy |

**Flash Sale Error Example** (409):
```json
{
  "success": false,
  "error": {
    "code": "TICKET_INSUFFICIENT_QUANTITY",
    "message": "Không đủ vé. Còn lại: 3",
    "details": {
      "ticketTypeId": "tt-uuid-1",
      "ticketTypeName": "VIP",
      "requested": 5,
      "available": 3
    },
    "timestamp": "2026-02-10T10:30:00Z",
    "path": "/api/v1/bookings/reserve"
  }
}
```

---

## 8.6. Payment Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `PAYMENT_NOT_FOUND` | 404 | Transaction không tồn tại |
| `PAYMENT_ALREADY_COMPLETED` | 409 | Đã thanh toán rồi |
| `PAYMENT_FAILED` | 422 | VNPay từ chối giao dịch |
| `PAYMENT_HASH_INVALID` | 400 | vnp_SecureHash không hợp lệ |
| `PAYMENT_AMOUNT_MISMATCH` | 400 | Số tiền không khớp |
| `PAYMENT_EXPIRED` | 422 | Hết hạn thanh toán |
| `REFUND_NOT_ELIGIBLE` | 422 | Không đủ điều kiện hoàn tiền |
| `REFUND_ALREADY_PROCESSED` | 409 | Đã hoàn tiền rồi |
| `REFUND_AMOUNT_EXCEEDED` | 400 | Số tiền hoàn vượt quá giao dịch gốc |

---

## 8.7. Promotion Errors

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `PROMO_NOT_FOUND` | 404 | Mã không tồn tại |
| `PROMO_EXPIRED` | 422 | Mã đã hết hạn |
| `PROMO_NOT_ACTIVE` | 422 | Mã chưa active hoặc đã bị pause |
| `PROMO_MAX_USES_REACHED` | 409 | Mã đã dùng hết lượt |
| `PROMO_ALREADY_USED_BY_USER` | 409 | User đã sử dụng mã này |
| `PROMO_MIN_ORDER_NOT_MET` | 422 | Chưa đạt giá trị đơn hàng tối thiểu |
| `PROMO_NOT_APPLICABLE_TO_EVENT` | 422 | Mã không áp dụng cho event này |

---

## 8.8. Frontend Error Handling Guide

```javascript
// Recommended error handling pattern (React example)
async function apiCall(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();

  if (!body.success) {
    const { code, message, details } = body.error;

    switch (code) {
      // Auth errors → redirect to login
      case 'UNAUTHORIZED':
      case 'AUTH_TOKEN_EXPIRED':
      case 'AUTH_TOKEN_INVALID':
        await refreshToken(); // Try refresh first
        break;

      // Validation errors → show per-field messages
      case 'VALIDATION_ERROR':
        setFieldErrors(details); // details = [{ field, message }]
        break;

      // Flash sale concurrency → show toast + suggest retry
      case 'TICKET_SOLD_OUT':
        toast.error('Rất tiếc, vé đã hết!');
        break;
      case 'TICKET_INSUFFICIENT_QUANTITY':
        toast.warning(`Chỉ còn ${details.available} vé`);
        break;
      case 'RESERVATION_EXPIRED':
        toast.warning('Đã hết thời gian giữ vé. Vui lòng thử lại.');
        navigate('/events/' + eventId);
        break;

      // Rate limiting → show countdown
      case 'RATE_LIMIT_EXCEEDED':
        toast.info('Vui lòng chờ 1 phút rồi thử lại.');
        break;

      // Default → generic toast
      default:
        toast.error(message || 'Có lỗi xảy ra. Vui lòng thử lại sau.');
    }

    throw new ApiError(code, message, details);
  }

  return body.data;
}
```

---

# PART 9: Security Considerations

---

## 9.1. Authentication & JWT Security

### JWT Configuration

| Parameter | Value | Notes |
|-----------|-------|-------|
| Algorithm | RS256 | RSA 2048-bit, asymmetric signing |
| Access Token TTL | 15 minutes | Short-lived for security |
| Refresh Token TTL | 7 days | Stored securely in HttpOnly cookie |
| Issuer | `http://localhost:9090/realms/ticketbox` | Keycloak realm URL |
| Audience | `ticketbox-api` | Validated by API Gateway |

### Token Refresh Flow

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant KC as Keycloak

    Note over FE: Access token expires (15 min)
    FE->>KC: POST /token (grant_type=refresh_token)
    alt Refresh token valid
        KC->>FE: New access_token + refresh_token
        Note over FE: Continue API calls
    else Refresh token expired (7 days)
        KC->>FE: 401 Invalid grant
        Note over FE: Redirect → Login page
    end
```

### Security Rules

- **Never store JWT in `localStorage`** — vulnerable to XSS
- Store access token in **memory** (React state/context)
- Store refresh token as **HttpOnly, Secure, SameSite=Strict** cookie
- Always validate token **server-side** with Keycloak JWKS endpoint
- Rotate JWKS keys periodically

---

## 9.2. API Gateway Security

API Gateway (Spring Cloud Gateway) enforces security at the edge:

```yaml
# Gateway Security Config
spring:
  cloud:
    gateway:
      routes:
        - id: core-service
          uri: lb://core-service
          predicates:
            - Path=/api/v1/events/**, /api/v1/bookings/**, /api/v1/payments/**
          filters:
            - JwtAuthFilter          # Validate JWT
            - RateLimiter            # Redis-based rate limiting
            - RequestSizeLimit=5MB   # Prevent large payloads
            - RemoveRequestHeader=Cookie  # Don't forward cookies to services
```

**Gateway Responsibilities**:
1. ✅ JWT validation (via Keycloak JWKS)
2. ✅ Extract user info from JWT → inject `X-User-Id`, `X-User-Roles` headers
3. ✅ Rate limiting (Redis Token Bucket)
4. ✅ Request size limiting
5. ✅ CORS enforcement
6. ❌ Business logic (delegated to services)

---

## 9.3. CORS (Cross-Origin Resource Sharing)

```yaml
# Gateway CORS Config
spring:
  cloud:
    gateway:
      globalcors:
        cors-configurations:
          '[/**]':
            allowedOrigins:
              - "http://localhost:5173"       # Dev frontend
              - "https://ticketbox.example.com" # Production
            allowedMethods:
              - GET
              - POST
              - PUT
              - PATCH
              - DELETE
              - OPTIONS
            allowedHeaders:
              - Authorization
              - Content-Type
              - X-Request-ID
              - Accept-Language
            exposedHeaders:
              - X-RateLimit-Remaining
              - X-RateLimit-Reset
            allowCredentials: true
            maxAge: 3600
```

> [!WARNING]
> **Không bao giờ** dùng `allowedOrigins: "*"` cho production. Luôn whitelist cụ thể origin.

---

## 9.4. Rate Limiting

### Configuration per Endpoint

| Endpoint Group | Limit | Window | Key | Reason |
|----------------|-------|--------|-----|--------|
| Public APIs (events, categories) | 100 req | 1 min | IP | Prevent scraping |
| Authenticated APIs | 60 req | 1 min | User ID | Normal usage |
| **Flash Sale Reserve** | **3 req** | **1 min** | **User ID** | **Prevent ticket hoarding** |
| Login/Auth | 10 req | 5 min | IP | Brute force protection |
| Admin APIs | 200 req | 1 min | User ID | Higher limit for admin |

### Rate Limit Response Headers

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1707580260
```

### Rate Limit Exceeded Response (429)

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Quá giới hạn request. Vui lòng thử lại sau 45 giây.",
    "details": {
      "limit": 3,
      "window": "1 min",
      "retryAfter": 45
    }
  }
}
```

---

## 9.5. Input Validation & Sanitization

### Server-side Validation (Spring Boot)

| Check | Implementation | Example |
|-------|----------------|---------|
| Required fields | `@NotNull`, `@NotBlank` | `title` must not be empty |
| String length | `@Size(min, max)` | `title`: 5-255 chars |
| Number range | `@Min`, `@Max`, `@Positive` | `price >= 0` |
| Email format | `@Email` | Valid email regex |
| Phone format | `@Pattern` | `^\+?[0-9]{10,15}$` |
| UUID format | `@UUID` | Valid UUID v4 |
| Date constraints | `@Future`, `@FutureOrPresent` | `startDatetime` must be future |
| Custom business | Custom validator | `endDatetime > startDatetime` |
| HTML sanitization | OWASP Java HTML Sanitizer | Strip XSS from `description` fields |
| SQL Injection | JPA Parameterized queries | All queries use prepared statements |

### Payload Size Limits

| Content Type | Max Size | Endpoint |
|-------------|----------|----------|
| JSON body | 1 MB | All POST/PUT/PATCH |
| File upload | 5 MB | Image upload |
| QR code image | 500 KB | Ticket QR |

---

## 9.6. Data Protection

| Data Type | Storage | Protection |
|-----------|---------|------------|
| Passwords | Keycloak | Argon2id hashing (Keycloak default) |
| JWT signing key | Keycloak | RSA 2048-bit private key |
| VNPay secret | Environment variable | Never in code/config files |
| User PII (email, phone) | MongoDB/PostgreSQL | Encrypted at rest |
| Payment card data | **Never stored** | PCI DSS — delegate to VNPay |
| QR code checksum | PostgreSQL | SHA-256 HMAC with app secret |

> [!CAUTION]
> **Tuyệt đối không** lưu trữ thông tin thẻ thanh toán. Mọi xử lý thanh toán đều qua VNPay gateway. Hệ thống chỉ lưu `transactionNumber` và `status`.

---

## 9.7. Flash Sale Security (Anti-abuse)

| Threat | Mitigation |
|--------|------------|
| Bot ticket hoarding | Rate limit 3 req/min + CAPTCHA (optional) |
| Race condition | Redis distributed lock (Redisson) |
| Overselling | Optimistic locking (`version` field) + DB constraint |
| Reservation abuse | Auto-expire after 15 min + max 2 active reservations |
| Replay attack | Idempotency key per reservation request |
| DDoS on sale start | Connection pooling + circuit breaker (Resilience4j) |

---

# PART 10: API Priority Classification

> [!IMPORTANT]
> **P0** = Must-have cho MVP demo. Không có thì không demo được end-to-end.  
> **P1** = Should-have. Quan trọng nhưng demo vẫn chạy được nếu skip.  
> **P2** = Nice-to-have. Bổ sung khi có thời gian.

---

## 10.1. P0 — Must-Have (MVP Demo)

> ⚡ Flow demo chính: **Browse Events → Event Detail → Buy Ticket → Payment → View Ticket with QR**

| # | API Endpoint | Method | Service | Notes |
|---|-------------|--------|---------|-------|
| 1 | `/api/v1/events` | GET | Core | Home page + listing + search |
| 2 | `/api/v1/events/featured` | GET | Core | Home page carousel |
| 3 | `/api/v1/events/{idOrSlug}` | GET | Core | Event detail page |
| 4 | `/api/v1/categories` | GET | Core | Category filter |
| 5 | `/api/v1/bookings/reserve` | POST | Core | **Step 1 — Hold tickets** |
| 6 | `/api/v1/bookings/confirm` | POST | Core | **Step 2 — Create order** |
| 7 | `/api/v1/payments/create-url` | POST | Core | Redirect to VNPay |
| 8 | `/api/v1/payments/vnpay-return` | GET | Core | Payment result handler |
| 9 | `/api/v1/payments/vnpay-ipn` | POST | Core | VNPay webhook (issue tickets) |
| 10 | `/api/v1/payments/{orderId}/status` | GET | Core | Payment status check |
| 11 | `/api/v1/orders/me` | GET | Core | My Orders page |
| 12 | `/api/v1/orders/{orderId}` | GET | Core | Order detail |
| 13 | `/api/v1/tickets/me` | GET | Core | **My Tickets page** |
| 14 | `/api/v1/tickets/{ticketId}/qr` | GET | Core | **QR code image** |
| 15 | `/api/v1/users/me` | GET | User | Profile page |
| 16 | `/api/v1/users/me` | PATCH | User | Update profile |

**Tổng: 16 endpoints P0** → Đủ cho flow mua vé end-to-end

---

## 10.2. P1 — Should-Have

| # | API Endpoint | Method | Service | Notes |
|---|-------------|--------|---------|-------|
| 17 | `/api/v1/events` | POST | Core | Organizer tạo event |
| 18 | `/api/v1/events/{id}` | PUT | Core | Organizer sửa event |
| 19 | `/api/v1/events/{id}/status` | PATCH | Core | Publish/cancel event |
| 20 | `/api/v1/events/{id}` | DELETE | Core | Soft delete event |
| 21 | `/api/v1/events/{id}/analytics` | GET | Core | Event analytics |
| 22 | `/api/v1/organizers/me/dashboard` | GET | Core | Organizer dashboard |
| 23 | `/api/v1/organizers/me/events/{id}/orders` | GET | Core | Organizer xem orders |
| 24 | `/api/v1/tickets/{id}/check-in` | POST | Core | **QR Check-in** |
| 25 | `/api/v1/organizers/me/events/{id}/check-in-summary` | GET | Core | Check-in stats |
| 26 | `/api/v1/orders/{id}/cancel` | POST | Core | Cancel order |
| 27 | `/api/v1/payments/{id}/refund` | POST | Core | Request refund |
| 28 | `/api/v1/promotions/validate` | POST | Core | Validate voucher |
| 29 | `/api/v1/users/organizers/register` | POST | User | Register as organizer |
| 30 | `/api/v1/users/organizers/me` | GET | User | My organizer profile |
| 31 | `/api/v1/users/organizers/me` | PUT | User | Update organizer profile |
| 32 | `/api/v1/users/organizers/{id}` | GET | User | Public organizer page |
| 33 | `/api/v1/bookings/reservations/{id}` | DELETE | Core | Cancel reservation |

**Tổng: 17 endpoints P1** → Organizer features + Flash Sale + Promotions

---

## 10.3. P2 — Nice-to-Have

| # | API Endpoint | Method | Service | Notes |
|---|-------------|--------|---------|-------|
| 34 | `/api/v1/admin/dashboard` | GET | Core | Admin dashboard |
| 35 | `/api/v1/admin/users` | GET | User | User management |
| 36 | `/api/v1/admin/users/{id}/status` | PATCH | User | Suspend/activate |
| 37 | `/api/v1/admin/events` | GET | Core | All events list |
| 38 | `/api/v1/admin/events/{id}/status` | PATCH | Core | Force status change |
| 39 | `/api/v1/admin/orders` | GET | Core | All orders |
| 40 | `/api/v1/admin/refunds` | GET | Core | Pending refunds |
| 41 | `/api/v1/admin/refunds/{id}` | PATCH | Core | Approve/reject refund |
| 42 | `/api/v1/admin/categories` | POST | Core | Create category |
| 43 | `/api/v1/admin/categories/{id}` | PUT | Core | Update category |
| 44 | `/api/v1/admin/promotions` | POST | Core | Create promotion |
| 45 | `/api/v1/admin/promotions/{id}` | PUT | Core | Update promotion |
| 46 | `/api/v1/admin/health` | GET | Core | System health |
| 47 | `/api/v1/venues` | GET | Core | Venue listing |
| 48 | `/api/v1/venues/{id}` | GET | Core | Venue detail |

**Tổng: 15 endpoints P2** → Admin panel + venue management

---

## 10.4. Development Timeline

```mermaid
gantt
    title API Development Priority
    dateFormat YYYY-MM-DD
    axisFormat %m/%d

    section P0 — MVP
    Events API (GET)           :p0_1, 2026-02-11, 3d
    Booking Reserve + Confirm  :p0_2, after p0_1, 4d
    Payment (VNPay)            :p0_3, after p0_2, 3d
    Orders + Tickets + QR      :p0_4, after p0_3, 3d
    User Profile               :p0_5, 2026-02-11, 2d

    section P1 — Features
    Organizer Event CRUD       :p1_1, after p0_4, 3d
    Organizer Dashboard        :p1_2, after p1_1, 2d
    Check-in + QR Scan         :p1_3, after p1_2, 2d
    Promotions                 :p1_4, after p1_3, 2d
    Refunds                    :p1_5, after p1_3, 2d

    section P2 — Admin
    Admin Dashboard            :p2_1, after p1_5, 3d
    Admin User/Event Mgmt      :p2_2, after p2_1, 3d
    Admin Refund Approval      :p2_3, after p2_2, 2d
```

---

## 10.5. API Summary Statistics

| Metric | Count |
|--------|-------|
| **Total API Endpoints** | **48** |
| P0 (MVP) | 16 |
| P1 (Should-Have) | 17 |
| P2 (Nice-to-Have) | 15 |
| Public (No Auth) | 8 |
| Authenticated (Any Role) | 18 |
| ORGANIZER-only | 12 |
| ADMIN-only | 10 |
---

# PART 11: AI Service APIs (P2 — Optional)

**Service**: AI Service (Port 8085)  
**Database**: PostgreSQL (`ai_schema` + pgvector)  
**Base Path**: `/api/v1/ai`  
**Responsibilities**: RAG Chatbot, Event Recommendations  
**Tech Stack**: LangChain4j + OpenAI API + pgvector

> [!NOTE]
> AI Service là module **P2 (Optional)**. Hệ thống hoạt động hoàn toàn bình thường khi không có AI Service. Chỉ triển khai khi còn thời gian sau MVP.

---

## 11.1. RAG Chatbot Architecture

```mermaid
sequenceDiagram
    participant User
    participant FE as Frontend (Chat Widget)
    participant GW as API Gateway
    participant AI as AI Service
    participant PG as PostgreSQL (pgvector)
    participant LLM as OpenAI API

    User->>FE: "Sự kiện Rock nào sắp tới?"
    FE->>GW: POST /api/v1/ai/chat
    GW->>AI: Forward
    AI->>PG: Vector similarity search (cosine) on documents
    PG-->>AI: Top-K relevant chunks (events, FAQ...)
    AI->>LLM: Prompt = system_prompt + context_chunks + user_question
    LLM-->>AI: Generated answer
    AI->>PG: Save message to conversations/messages
    AI-->>FE: Streaming/full response
    FE->>User: "Có 3 sự kiện Rock sắp tới: ..."
```

---

## 11.2. Send Chat Message

```http
POST /api/v1/ai/chat
```

**Auth**: Optional (anonymous allowed, authenticated preferred for history)

**Request Body**:
```json
{
  "message": "Sự kiện Rock nào sắp tới ở TP.HCM?",
  "conversationId": null,
  "context": {
    "currentEventId": null,
    "currentPage": "home"
  }
}
```

**Response 200**:
```json
{
  "success": true,
  "data": {
    "conversationId": "conv-uuid-1",
    "messageId": "msg-uuid-1",
    "role": "ASSISTANT",
    "content": "Xin chào! Hiện tại có 3 sự kiện Rock sắp diễn ra tại TP.HCM:\n\n1. **Rock Storm 2026** — 15/03/2026, SVĐ Mỹ Đình\n   Giá vé từ 500.000₫. [Xem chi tiết](/events/rock-storm-2026)\n\n2. **Indie Rock Night** — 22/03/2026, Cargo Bar\n   Giá vé: 200.000₫. [Xem chi tiết](/events/indie-rock-night)\n\n3. **Underground Rock Fest** — 05/04/2026, Saigon Outcast\n   Giá vé từ 150.000₫. [Xem chi tiết](/events/underground-rock-fest)\n\nBạn muốn tìm hiểu thêm về sự kiện nào?",
    "sources": [
      {
        "documentId": "doc-uuid-1",
        "sourceType": "EVENT",
        "sourceId": "event-uuid-1",
        "title": "Rock Storm 2026",
        "relevanceScore": 0.94
      },
      {
        "documentId": "doc-uuid-2",
        "sourceType": "EVENT",
        "sourceId": "event-uuid-2",
        "title": "Indie Rock Night",
        "relevanceScore": 0.87
      }
    ],
    "tokensUsed": 245,
    "modelUsed": "gpt-4o-mini",
    "responseTimeMs": 1200,
    "createdAt": "2026-02-10T10:30:00+07:00"
  }
}
```

**Errors**:
| Code | Status | Description |
|------|--------|-------------|
| `AI_SERVICE_UNAVAILABLE` | 503 | AI Service / OpenAI API đang down |
| `AI_RATE_LIMIT` | 429 | Quá giới hạn chat (10 msg/min) |
| `AI_CONTENT_FILTERED` | 422 | Nội dung bị lọc bởi content policy |
| `AI_CONTEXT_TOO_LONG` | 400 | Conversation quá dài, cần start mới |

---

## 11.3. Get Conversation History

```http
GET /api/v1/ai/conversations/{conversationId}
```

**Auth**: Required (owner of conversation)

**Response 200**:
```json
{
  "success": true,
  "data": {
    "conversationId": "conv-uuid-1",
    "messages": [
      {
        "id": "msg-uuid-0",
        "role": "USER",
        "content": "Sự kiện Rock nào sắp tới ở TP.HCM?",
        "createdAt": "2026-02-10T10:30:00+07:00"
      },
      {
        "id": "msg-uuid-1",
        "role": "ASSISTANT",
        "content": "Xin chào! Hiện tại có 3 sự kiện Rock...",
        "tokensUsed": 245,
        "sources": [ { "title": "Rock Storm 2026", "relevanceScore": 0.94 } ],
        "userRating": null,
        "createdAt": "2026-02-10T10:30:01+07:00"
      }
    ],
    "startedAt": "2026-02-10T10:30:00+07:00",
    "isActive": true
  }
}
```

---

## 11.4. Rate Chat Response (Feedback)

```http
POST /api/v1/ai/messages/{messageId}/feedback
```

**Auth**: Required (conversation owner)

**Request Body**:
```json
{
  "rating": 5,
  "feedback": "Câu trả lời rất hữu ích!"
}
```

**Response 200**: `{ "success": true, "message": "Cảm ơn phản hồi của bạn!" }`

---

## 11.5. Get Event Recommendations

```http
GET /api/v1/ai/recommendations
```

**Auth**: Optional (personalized if authenticated)

**Query Params**: `limit` (int, default 6), `eventId` (uuid, for "similar events")

**Response 200**:
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "eventId": "event-uuid-1",
        "title": "Rock Storm 2026",
        "thumbnailUrl": "https://cdn.example.com/thumb.jpg",
        "startDatetime": "2026-03-15T19:00:00+07:00",
        "minPrice": 500000,
        "category": "Âm nhạc",
        "reason": "Dựa trên sự kiện bạn đã xem",
        "score": 0.92
      }
    ],
    "strategy": "collaborative_filtering"
  }
}
```

**Strategies**: `collaborative_filtering` (logged-in user), `content_based` (similar events), `trending` (popular events, fallback)

---

## 11.6. Admin — RAG Document Management

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/admin/ai/documents` | ADMIN | List indexed documents |
| POST | `/api/v1/admin/ai/documents/sync` | ADMIN | Sync events → RAG documents |
| POST | `/api/v1/admin/ai/documents` | ADMIN | Upload custom document (FAQ, Policy) |
| DELETE | `/api/v1/admin/ai/documents/{id}` | ADMIN | Remove document from index |
| GET | `/api/v1/admin/ai/stats` | ADMIN | Chat usage statistics |

**Sync Events Request**:
```json
{
  "syncType": "FULL",
  "sourceTypes": ["EVENT", "FAQ"]
}
```

**Admin Stats Response**:
```json
{
  "success": true,
  "data": {
    "totalConversations": 1200,
    "totalMessages": 5800,
    "averageResponseTimeMs": 980,
    "averageRating": 4.2,
    "topQuestions": [
      { "question": "Cách mua vé", "count": 150 },
      { "question": "Hoàn tiền", "count": 85 },
      { "question": "Check-in", "count": 62 }
    ],
    "documentsIndexed": 320,
    "totalTokensUsed": 450000
  }
}
```

---

# Updated API Summary (with AI Service)

| Metric | Count |
|--------|-------|
| **Total API Endpoints** | **56** |
| P0 (MVP) | 16 |
| P1 (Should-Have) | 17 |
| P2 (Nice-to-Have) | 15 |
| P2 — AI Service | 8 |
| **Services** | **3** (User + Core + AI) |

---

# Appendix: Swagger / OpenAPI

> [!NOTE]
> Backend services auto-generate Swagger UI via **SpringDoc OpenAPI**:
> - Core Service: `http://localhost:8082/swagger-ui.html`
> - User Service: `http://localhost:8081/swagger-ui.html`
> - AI Service: `http://localhost:8085/swagger-ui.html`
>
> The `openapi.yaml` file in this repository can be imported to tools like Postman, Insomnia, or Swagger Editor for testing.

---

> **📘 End of API Design Documentation**  
> **Version**: 1.1.0 | **Date**: 2026-02-10 | **Total Endpoints**: 56 (3 services)  
> **Status**: Complete — Ready for implementation
