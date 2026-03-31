package com.flashticket.user.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * User Entity - MongoDB Document
 * 
 * Sync với Keycloak cho authentication
 * Lưu trữ profile và preferences của user
 */
@Document(collection = "users")
@CompoundIndex(name = "idx_users_admin_list", def = "{'status': 1, 'roles': 1, 'createdAt': -1}")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {
    
    // ========== Primary Identifiers ==========
    @Id
    private String id; // UUID string - same as Keycloak user ID
    
    @Indexed(unique = true)
    private String keycloakId; // Keycloak user UUID
    
    // ========== Basic Information ==========
    @Indexed(unique = true)
    private String email;

    // @Builder.Default bật cơ chế default value cho field khi sử dụng Builder.
    // nếu không có @Builder.Default thì khi không setEmailVerified() nó sẽ gán emailVerified = null thay vì false default
    @Builder.Default
    private Boolean emailVerified = false;
    
    @Indexed(sparse = true) // Index chỉ lập chỉ mục cho những document thực sự chứa trường phone, cây index chỉ truy vấn những thằng khác null
    private String phone;
    
    @Builder.Default
    private Boolean phoneVerified = false;
    
    // ========== Profile ==========
    @Builder.Default
    private Profile profile = new Profile();
    
    // ========== Address ==========
    @Builder.Default
    private List<Address> addresses = new ArrayList<>();
    
    // ========== Roles & Permissions ==========
    @Indexed
    @Builder.Default
    private List<UserRole> roles = new ArrayList<>();
    
    // ========== Status ==========
    @Indexed
    @Builder.Default
    private UserStatus status = UserStatus.ACTIVE;
    
    // ========== Preferences ==========
    @Builder.Default
    private Preferences preferences = new Preferences();
    
    // ========== OAuth Connections ==========
    @Builder.Default
    private List<OAuthConnection> oauthConnections = new ArrayList<>();
    
    // ========== Security ==========
    @Builder.Default
    private Security security = new Security();
    
    // ========== Activity Tracking ==========
    private Instant lastLoginAt;
    private String lastLoginIp;
    
    @Builder.Default
    private Integer loginCount = 0;
    
    // ========== Organizer Reference ==========
    private String organizerProfileId; // Reference to organizer_profiles collection
    
    // ========== Audit Fields ==========
    @CreatedDate
    private Instant createdAt;
    
    @LastModifiedDate
    private Instant updatedAt;
    
    @CreatedBy
    private String createdBy;
    
    @LastModifiedBy
    private String updatedBy;
    
    @Builder.Default
    private Boolean isDeleted = false;
    
    private Instant deletedAt;
    
    // ========== Embedded Classes ==========
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Profile {
        private String firstName;
        private String lastName;
        private String displayName;
        private String avatarUrl;
        private LocalDate dateOfBirth;
        private Gender gender;
        private String bio;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Preferences {
        @Builder.Default
        private String language = "vi";
        
        @Builder.Default
        private String timezone = "Asia/Ho_Chi_Minh";
        
        @Builder.Default
        private String currency = "VND";
        
        @Builder.Default
        private NotificationSettings notifications = new NotificationSettings();
        
        @Builder.Default
        private List<String> favoriteCategories = new ArrayList<>();
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NotificationSettings {
        @Builder.Default
        private Boolean email = true;
        
        @Builder.Default
        private Boolean sms = false;
        
        @Builder.Default
        private Boolean push = true;
        
        @Builder.Default
        private Boolean marketing = false;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OAuthConnection {
        private OAuthProvider provider;
        private String providerId;
        private String email;
        private Instant connectedAt;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Security {
        @Builder.Default
        private Boolean twoFactorEnabled = false;
        
        private TwoFactorMethod twoFactorMethod;
        private Instant lastPasswordChange;
        
        @Builder.Default
        private Integer failedLoginAttempts = 0;
        
        private Instant lockoutUntil;
    }
    
    // ========== Enums ==========
    
    public enum Gender {
        MALE, FEMALE, OTHER, PREFER_NOT_TO_SAY
    }
    
    public enum OAuthProvider {
        GOOGLE, FACEBOOK, APPLE
    }
    
    public enum TwoFactorMethod {
        APP, SMS
    }
}
