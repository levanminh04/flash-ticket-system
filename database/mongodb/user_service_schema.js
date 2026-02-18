// ============================================================================
// TICKETBOX USER SERVICE - MONGODB SCHEMA DEFINITIONS
// ============================================================================
// Database: MongoDB
// Service: User Service
// Collections: users, organizer_profiles, refresh_tokens
// ============================================================================

// ============================================================================
// COLLECTION: users
// ============================================================================
// Mô tả: Thông tin người dùng - sync với Keycloak
// Index Strategy: Compound indexes cho các query patterns phổ biến
// ============================================================================

db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      title: "User Schema Validation",
      required: ["_id", "keycloakId", "email", "roles", "status", "createdAt", "updatedAt"],
      properties: {
        // ========== Primary Identifiers ==========
        _id: {
          bsonType: "string",
          description: "UUID string - same as Keycloak user ID for consistency"
        },
        keycloakId: {
          bsonType: "string",
          description: "Keycloak user UUID - dùng để sync với Identity Provider"
        },

        // ========== Basic Information ==========
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "Email - unique, dùng cho login và notifications"
        },
        emailVerified: {
          bsonType: "bool",
          description: "Email đã verify chưa (từ Keycloak)"
        },

        phone: {
          bsonType: ["string", "null"],
          pattern: "^\\+?[0-9]{10,15}$",
          description: "Số điện thoại - optional, dùng cho SMS notifications"
        },
        phoneVerified: {
          bsonType: "bool",
          description: "Phone đã verify chưa"
        },

        // ========== Profile ==========
        profile: {
          bsonType: "object",
          description: "Thông tin cá nhân",
          properties: {
            firstName: {
              bsonType: ["string", "null"],
              maxLength: 100,
              description: "Tên"
            },
            lastName: {
              bsonType: ["string", "null"],
              maxLength: 100,
              description: "Họ"
            },
            displayName: {
              bsonType: ["string", "null"],
              maxLength: 200,
              description: "Tên hiển thị (computed: firstName + lastName hoặc custom)"
            },
            avatarUrl: {
              bsonType: ["string", "null"],
              description: "URL avatar - lưu trên S3/CloudStorage"
            },
            dateOfBirth: {
              bsonType: ["date", "null"],
              description: "Ngày sinh - dùng cho verify tuổi (events 18+)"
            },
            gender: {
              enum: ["male", "female", "other", "prefer_not_to_say", null],
              description: "Giới tính"
            },
            bio: {
              bsonType: ["string", "null"],
              maxLength: 500,
              description: "Giới thiệu bản thân"
            }
          }
        },

        // ========== Address ==========
        addresses: {
          bsonType: "array",
          description: "Danh sách địa chỉ",
          items: {
            bsonType: "object",
            required: ["type", "city"],
            properties: {
              type: {
                enum: ["home", "work", "billing", "other"],
                description: "Loại địa chỉ"
              },
              isDefault: {
                bsonType: "bool",
                description: "Địa chỉ mặc định"
              },
              street: {
                bsonType: ["string", "null"]
              },
              ward: {
                bsonType: ["string", "null"],
                description: "Phường/Xã"
              },
              district: {
                bsonType: ["string", "null"],
                description: "Quận/Huyện"
              },
              city: {
                bsonType: "string",
                description: "Thành phố"
              },
              country: {
                bsonType: "string",
                description: "Quốc gia"
              },
              postalCode: {
                bsonType: ["string", "null"]
              }
            }
          }
        },

        // ========== Roles & Permissions ==========
        roles: {
          bsonType: "array",
          description: "Danh sách roles - sync từ Keycloak",
          items: {
            enum: ["BUYER", "ORGANIZER", "ADMIN", "SUPER_ADMIN"]
          },
          minItems: 1
        },

        // ========== Status ==========
        status: {
          enum: ["ACTIVE", "INACTIVE", "SUSPENDED", "PENDING_VERIFICATION"],
          description: "Trạng thái tài khoản"
        },

        // ========== Preferences ==========
        preferences: {
          bsonType: "object",
          description: "Cài đặt người dùng",
          properties: {
            language: {
              enum: ["vi", "en"],
              description: "Ngôn ngữ ưa thích"
            },
            timezone: {
              bsonType: "string",
              description: "Timezone: Asia/Ho_Chi_Minh"
            },
            currency: {
              enum: ["VND", "USD"],
              description: "Đơn vị tiền tệ"
            },
            notifications: {
              bsonType: "object",
              properties: {
                email: {
                  bsonType: "bool",
                  description: "Nhận thông báo qua email"
                },
                sms: {
                  bsonType: "bool",
                  description: "Nhận thông báo qua SMS"
                },
                push: {
                  bsonType: "bool",
                  description: "Nhận push notification"
                },
                marketing: {
                  bsonType: "bool",
                  description: "Nhận email marketing"
                }
              }
            },
            favoriteCategories: {
              bsonType: "array",
              description: "Danh mục yêu thích - UUID references tới event_schema.categories",
              items: {
                bsonType: "string"
              }
            }
          }
        },

        // ========== OAuth Connections ==========
        oauthConnections: {
          bsonType: "array",
          description: "Các tài khoản OAuth đã liên kết",
          items: {
            bsonType: "object",
            properties: {
              provider: {
                enum: ["google", "facebook", "apple"],
                description: "OAuth provider"
              },
              providerId: {
                bsonType: "string",
                description: "User ID từ provider"
              },
              email: {
                bsonType: "string"
              },
              connectedAt: {
                bsonType: "date"
              }
            }
          }
        },

        // ========== Security ==========
        security: {
          bsonType: "object",
          properties: {
            twoFactorEnabled: {
              bsonType: "bool",
              description: "Đã bật 2FA chưa"
            },
            twoFactorMethod: {
              enum: ["app", "sms", null],
              description: "Phương thức 2FA"
            },
            lastPasswordChange: {
              bsonType: ["date", "null"]
            },
            failedLoginAttempts: {
              bsonType: "int",
              minimum: 0
            },
            lockoutUntil: {
              bsonType: ["date", "null"]
            }
          }
        },

        // ========== Activity Tracking ==========
        lastLoginAt: {
          bsonType: ["date", "null"],
          description: "Lần đăng nhập gần nhất"
        },
        lastLoginIp: {
          bsonType: ["string", "null"],
          description: "IP lần đăng nhập gần nhất"
        },
        loginCount: {
          bsonType: "int",
          description: "Tổng số lần đăng nhập"
        },

        // ========== Organizer Reference ==========
        organizerProfileId: {
          bsonType: ["string", "null"],
          description: "Reference tới organizer_profiles collection - nếu user là Organizer"
        },

        // ========== Audit Fields ==========
        createdAt: {
          bsonType: "date",
          description: "Thời điểm tạo account"
        },
        updatedAt: {
          bsonType: "date",
          description: "Thời điểm cập nhật gần nhất"
        },
        createdBy: {
          bsonType: ["string", "null"],
          description: "Người tạo (admin hoặc self-register)"
        },
        updatedBy: {
          bsonType: ["string", "null"]
        },
        isDeleted: {
          bsonType: "bool",
          description: "Soft delete flag"
        },
        deletedAt: {
          bsonType: ["date", "null"]
        }
      }
    }
  },
  validationLevel: "moderate",  // Cho phép update partial documents
  validationAction: "warn"      // Log warning thay vì reject (development)
});

// Indexes for users collection
db.users.createIndex({ "email": 1 }, { unique: true, name: "idx_users_email" });
db.users.createIndex({ "keycloakId": 1 }, { unique: true, name: "idx_users_keycloak" });
db.users.createIndex({ "phone": 1 }, { sparse: true, name: "idx_users_phone" });
db.users.createIndex({ "roles": 1 }, { name: "idx_users_roles" });
db.users.createIndex({ "status": 1 }, { name: "idx_users_status" });
db.users.createIndex({ "createdAt": -1 }, { name: "idx_users_created" });
db.users.createIndex({ "profile.displayName": "text" }, { name: "idx_users_search" });

// Compound index cho admin user listing
db.users.createIndex({ "status": 1, "roles": 1, "createdAt": -1 }, { name: "idx_users_admin_list" });


// ============================================================================
// COLLECTION: organizer_profiles
// ============================================================================
// Mô tả: Hồ sơ Ban Tổ Chức - thông tin bổ sung cho users có role ORGANIZER
// ============================================================================

db.createCollection("organizer_profiles", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      title: "Organizer Profile Schema Validation",
      required: ["_id", "userId", "organizerName", "status", "createdAt", "updatedAt"],
      properties: {
        // ========== Identifiers ==========
        _id: {
          bsonType: "string",
          description: "UUID string"
        },
        userId: {
          bsonType: "string",
          description: "Reference tới users collection"
        },

        // ========== Organization Info ==========
        organizerName: {
          bsonType: "string",
          maxLength: 200,
          description: "Tên tổ chức/công ty"
        },
        organizerSlug: {
          bsonType: "string",
          description: "URL-friendly name: abc-entertainment"
        },
        organizerType: {
          enum: ["individual", "company", "nonprofit", "government"],
          description: "Loại hình tổ chức"
        },

        description: {
          bsonType: ["string", "null"],
          maxLength: 2000,
          description: "Mô tả về tổ chức"
        },

        // ========== Branding ==========
        branding: {
          bsonType: "object",
          properties: {
            logoUrl: {
              bsonType: ["string", "null"],
              description: "Logo tổ chức"
            },
            bannerUrl: {
              bsonType: ["string", "null"],
              description: "Banner trang organizer"
            },
            primaryColor: {
              bsonType: ["string", "null"],
              description: "Màu chủ đạo: #FF5733"
            },
            websiteUrl: {
              bsonType: ["string", "null"]
            }
          }
        },

        // ========== Contact ==========
        contact: {
          bsonType: "object",
          properties: {
            email: {
              bsonType: "string",
              description: "Email liên hệ business"
            },
            phone: {
              bsonType: ["string", "null"]
            },
            address: {
              bsonType: ["string", "null"],
              description: "Địa chỉ văn phòng"
            }
          }
        },

        // ========== Social Links ==========
        socialLinks: {
          bsonType: "object",
          properties: {
            facebook: { bsonType: ["string", "null"] },
            instagram: { bsonType: ["string", "null"] },
            twitter: { bsonType: ["string", "null"] },
            youtube: { bsonType: ["string", "null"] },
            tiktok: { bsonType: ["string", "null"] }
          }
        },

        // ========== Business Registration (KYC) ==========
        businessInfo: {
          bsonType: "object",
          description: "Thông tin đăng ký kinh doanh - dùng cho KYC",
          properties: {
            taxCode: {
              bsonType: ["string", "null"],
              description: "Mã số thuế"
            },
            businessLicense: {
              bsonType: ["string", "null"],
              description: "Số ĐKKD"
            },
            representativeName: {
              bsonType: ["string", "null"],
              description: "Tên người đại diện"
            },
            representativeIdNumber: {
              bsonType: ["string", "null"],
              description: "Số CMND/CCCD người đại diện"
            }
          }
        },

        // ========== Bank Account (for payout) ==========
        bankAccount: {
          bsonType: "object",
          description: "Thông tin tài khoản nhận tiền",
          properties: {
            bankName: {
              bsonType: ["string", "null"]
            },
            bankCode: {
              bsonType: ["string", "null"],
              description: "VCB, TCB, ACB, etc."
            },
            accountNumber: {
              bsonType: ["string", "null"]
            },
            accountHolder: {
              bsonType: ["string", "null"],
              description: "Tên chủ tài khoản"
            },
            branch: {
              bsonType: ["string", "null"]
            }
          }
        },

        // ========== Verification Status ==========
        verification: {
          bsonType: "object",
          properties: {
            isVerified: {
              bsonType: "bool",
              description: "Đã verify KYC chưa"
            },
            verifiedAt: {
              bsonType: ["date", "null"]
            },
            verifiedBy: {
              bsonType: ["string", "null"],
              description: "Admin verify"
            },
            documents: {
              bsonType: "array",
              description: "Danh sách tài liệu đã submit",
              items: {
                bsonType: "object",
                properties: {
                  type: {
                    enum: ["business_license", "id_card", "bank_statement", "other"]
                  },
                  url: { bsonType: "string" },
                  uploadedAt: { bsonType: "date" },
                  status: {
                    enum: ["pending", "approved", "rejected"]
                  }
                }
              }
            }
          }
        },

        // ========== Statistics (denormalized) ==========
        statistics: {
          bsonType: "object",
          description: "Thống kê - cập nhật async",
          properties: {
            totalEvents: {
              bsonType: "int",
              description: "Tổng số events đã tổ chức"
            },
            totalTicketsSold: {
              bsonType: "int",
              description: "Tổng số vé đã bán"
            },
            totalRevenue: {
              bsonType: "decimal",
              description: "Tổng doanh thu"
            },
            averageRating: {
              bsonType: "double",
              description: "Rating trung bình từ attendees"
            },
            followerCount: {
              bsonType: "int",
              description: "Số người follow"
            }
          }
        },

        // ========== Status ==========
        status: {
          enum: ["PENDING", "ACTIVE", "SUSPENDED", "REJECTED"],
          description: "Trạng thái profile"
        },

        // ========== Audit Fields ==========
        createdAt: {
          bsonType: "date"
        },
        updatedAt: {
          bsonType: "date"
        },
        createdBy: {
          bsonType: ["string", "null"]
        },
        updatedBy: {
          bsonType: ["string", "null"]
        },
        isDeleted: {
          bsonType: "bool"
        }
      }
    }
  },
  validationLevel: "moderate",
  validationAction: "warn"
});

// Indexes for organizer_profiles
db.organizer_profiles.createIndex({ "userId": 1 }, { unique: true, name: "idx_organizers_user" });
db.organizer_profiles.createIndex({ "organizerSlug": 1 }, { unique: true, name: "idx_organizers_slug" });
db.organizer_profiles.createIndex({ "status": 1 }, { name: "idx_organizers_status" });
db.organizer_profiles.createIndex({ "verification.isVerified": 1 }, { name: "idx_organizers_verified" });
db.organizer_profiles.createIndex({ "organizerName": "text" }, { name: "idx_organizers_search" });


// ============================================================================
// COLLECTION: refresh_tokens
// ============================================================================
// Mô tả: Refresh tokens cho JWT - có TTL index để auto-expire
// ============================================================================

db.createCollection("refresh_tokens", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["_id", "userId", "token", "expiresAt", "createdAt"],
      properties: {
        _id: {
          bsonType: "string"
        },
        userId: {
          bsonType: "string",
          description: "Reference tới users"
        },
        token: {
          bsonType: "string",
          description: "Refresh token value (hashed)"
        },
        deviceInfo: {
          bsonType: "object",
          properties: {
            deviceId: { bsonType: ["string", "null"] },
            deviceName: { bsonType: ["string", "null"] },
            platform: { enum: ["web", "ios", "android", null] },
            browser: { bsonType: ["string", "null"] },
            os: { bsonType: ["string", "null"] }
          }
        },
        ipAddress: {
          bsonType: ["string", "null"]
        },
        isRevoked: {
          bsonType: "bool"
        },
        revokedAt: {
          bsonType: ["date", "null"]
        },
        revokedReason: {
          bsonType: ["string", "null"]
        },
        expiresAt: {
          bsonType: "date",
          description: "Thời điểm hết hạn - dùng cho TTL index"
        },
        createdAt: {
          bsonType: "date"
        }
      }
    }
  }
});

// Indexes for refresh_tokens
db.refresh_tokens.createIndex({ "userId": 1 }, { name: "idx_tokens_user" });
db.refresh_tokens.createIndex({ "token": 1 }, { unique: true, name: "idx_tokens_token" });
// TTL index - tự động xóa document sau khi hết hạn
db.refresh_tokens.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0, name: "idx_tokens_ttl" });


// ============================================================================
// COLLECTION: user_activity_logs
// ============================================================================
// Mô tả: Log hoạt động của user - analytics và security audit
// ============================================================================

db.createCollection("user_activity_logs", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["userId", "action", "timestamp"],
      properties: {
        userId: {
          bsonType: "string"
        },
        action: {
          enum: [
            "LOGIN", "LOGOUT", "LOGIN_FAILED",
            "PASSWORD_CHANGE", "PROFILE_UPDATE",
            "TICKET_PURCHASE", "TICKET_VIEW",
            "EVENT_VIEW", "EVENT_SEARCH",
            "ORGANIZER_PROFILE_CREATE", "ORGANIZER_PROFILE_UPDATE"
          ]
        },
        details: {
          bsonType: "object",
          description: "Chi tiết action - flexible schema"
        },
        ipAddress: {
          bsonType: ["string", "null"]
        },
        userAgent: {
          bsonType: ["string", "null"]
        },
        timestamp: {
          bsonType: "date"
        }
      }
    }
  }
});

// Indexes for activity logs
db.user_activity_logs.createIndex({ "userId": 1, "timestamp": -1 }, { name: "idx_logs_user_time" });
db.user_activity_logs.createIndex({ "action": 1, "timestamp": -1 }, { name: "idx_logs_action_time" });
// TTL - tự động xóa logs sau 90 ngày
db.user_activity_logs.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 7776000, name: "idx_logs_ttl" });


// ============================================================================
// SAMPLE DATA (Development)
// ============================================================================

// Sample User
db.users.insertOne({
  _id: "550e8400-e29b-41d4-a716-446655440001",
  keycloakId: "550e8400-e29b-41d4-a716-446655440001",
  email: "buyer@example.com",
  emailVerified: true,
  phone: "+84901234567",
  phoneVerified: false,
  profile: {
    firstName: "Văn A",
    lastName: "Nguyễn",
    displayName: "Nguyễn Văn A",
    avatarUrl: null,
    dateOfBirth: new Date("1995-05-15"),
    gender: "male",
    bio: "Yêu âm nhạc và các sự kiện live"
  },
  addresses: [
    {
      type: "home",
      isDefault: true,
      street: "123 Nguyễn Huệ",
      district: "Quận 1",
      city: "TP.HCM",
      country: "Vietnam"
    }
  ],
  roles: ["BUYER"],
  status: "ACTIVE",
  preferences: {
    language: "vi",
    timezone: "Asia/Ho_Chi_Minh",
    currency: "VND",
    notifications: {
      email: true,
      sms: false,
      push: true,
      marketing: false
    },
    favoriteCategories: []
  },
  oauthConnections: [],
  security: {
    twoFactorEnabled: false,
    twoFactorMethod: null,
    lastPasswordChange: new Date(),
    failedLoginAttempts: 0,
    lockoutUntil: null
  },
  lastLoginAt: new Date(),
  lastLoginIp: "192.168.1.1",
  loginCount: 5,
  organizerProfileId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
  updatedBy: null,
  isDeleted: false,
  deletedAt: null
});

// Sample Organizer User
db.users.insertOne({
  _id: "550e8400-e29b-41d4-a716-446655440002",
  keycloakId: "550e8400-e29b-41d4-a716-446655440002",
  email: "organizer@example.com",
  emailVerified: true,
  phone: "+84909876543",
  phoneVerified: true,
  profile: {
    firstName: "Minh",
    lastName: "Lê",
    displayName: "Lê Minh",
    avatarUrl: null,
    dateOfBirth: new Date("1990-10-20"),
    gender: "male",
    bio: "Event Organizer chuyên nghiệp"
  },
  addresses: [],
  roles: ["BUYER", "ORGANIZER"],
  status: "ACTIVE",
  preferences: {
    language: "vi",
    timezone: "Asia/Ho_Chi_Minh",
    currency: "VND",
    notifications: {
      email: true,
      sms: true,
      push: true,
      marketing: true
    },
    favoriteCategories: []
  },
  oauthConnections: [],
  security: {
    twoFactorEnabled: true,
    twoFactorMethod: "app",
    lastPasswordChange: new Date(),
    failedLoginAttempts: 0,
    lockoutUntil: null
  },
  lastLoginAt: new Date(),
  lastLoginIp: "192.168.1.2",
  loginCount: 50,
  organizerProfileId: "550e8400-e29b-41d4-a716-446655440003",
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: null,
  updatedBy: null,
  isDeleted: false,
  deletedAt: null
});

// Sample Organizer Profile
db.organizer_profiles.insertOne({
  _id: "550e8400-e29b-41d4-a716-446655440003",
  userId: "550e8400-e29b-41d4-a716-446655440002",
  organizerName: "ABC Entertainment",
  organizerSlug: "abc-entertainment",
  organizerType: "company",
  description: "Công ty tổ chức sự kiện âm nhạc và giải trí hàng đầu Việt Nam",
  branding: {
    logoUrl: null,
    bannerUrl: null,
    primaryColor: "#FF5733",
    websiteUrl: "https://abc-entertainment.vn"
  },
  contact: {
    email: "contact@abc-entertainment.vn",
    phone: "+84909876543",
    address: "123 Lê Lợi, Quận 1, TP.HCM"
  },
  socialLinks: {
    facebook: "https://facebook.com/abcentertainment",
    instagram: "https://instagram.com/abcentertainment",
    twitter: null,
    youtube: null,
    tiktok: null
  },
  businessInfo: {
    taxCode: "0123456789",
    businessLicense: "0123456789-001",
    representativeName: "Lê Minh",
    representativeIdNumber: "001234567890"
  },
  bankAccount: {
    bankName: "Vietcombank",
    bankCode: "VCB",
    accountNumber: "1234567890",
    accountHolder: "CONG TY TNHH ABC ENTERTAINMENT",
    branch: "Chi nhánh Quận 1"
  },
  verification: {
    isVerified: true,
    verifiedAt: new Date(),
    verifiedBy: "admin",
    documents: [
      {
        type: "business_license",
        url: "/documents/business_license.pdf",
        uploadedAt: new Date(),
        status: "approved"
      }
    ]
  },
  statistics: {
    totalEvents: 15,
    totalTicketsSold: 5000,
    totalRevenue: NumberDecimal("500000000"),
    averageRating: 4.5,
    followerCount: 1200
  },
  status: "ACTIVE",
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: "550e8400-e29b-41d4-a716-446655440002",
  updatedBy: null,
  isDeleted: false
});


// ============================================================================
// VERIFICATION
// ============================================================================

// List all collections
db.getCollectionNames();

// Check indexes
db.users.getIndexes();
db.organizer_profiles.getIndexes();
db.refresh_tokens.getIndexes();
db.user_activity_logs.getIndexes();

// Check validation rules
db.getCollectionInfos({ name: "users" });
