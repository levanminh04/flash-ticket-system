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
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Organizer Profile Entity - MongoDB Document
 * 
 * Thông tin bổ sung cho users có role ORGANIZER
 * Lưu trữ thông tin tổ chức, KYC, bank account
 */
@Document(collection = "organizer_profiles")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrganizerProfile {
    
    // ========== Identifiers ==========
    @Id
    private String id; // UUID string
    
    @Indexed(unique = true)
    private String userId; // Reference to users collection
    
    // ========== Organization Info ==========
    private String organizerName;
    
    @Indexed(unique = true)
    private String organizerSlug;
    
    private OrganizerType organizerType;
    private String description;
    
    // ========== Branding ==========
    @Builder.Default
    private Branding branding = new Branding();
    
    // ========== Contact ==========
    @Builder.Default
    private Contact contact = new Contact();
    
    // ========== Social Links ==========
    @Builder.Default
    private SocialLinks socialLinks = new SocialLinks();
    
    // ========== Business Registration (KYC) ==========
    @Builder.Default
    private BusinessInfo businessInfo = new BusinessInfo();
    
    // ========== Bank Account (for payout) ==========
    @Builder.Default
    private BankAccount bankAccount = new BankAccount();
    
    // ========== Verification Status ==========
    @Builder.Default
    private Verification verification = new Verification();
    
    // ========== Statistics (denormalized) ==========
    @Builder.Default
    private Statistics statistics = new Statistics();
    
    // ========== Status ==========
    @Indexed
    @Builder.Default
    private OrganizerStatus status = OrganizerStatus.PENDING;
    
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
    
    // ========== Embedded Classes ==========
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Branding {
        private String logoUrl;
        private String bannerUrl;
        private String primaryColor;
        private String websiteUrl;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Contact {
        private String email;
        private String phone;
        private String address;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SocialLinks {
        private String facebook;
        private String instagram;
        private String twitter;
        private String youtube;
        private String tiktok;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BusinessInfo {
        private String taxCode;
        private String businessLicense;
        private String representativeName;
        private String representativeIdNumber;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BankAccount {
        private String bankName;
        private String bankCode;
        private String accountNumber;
        private String accountHolder;
        private String branch;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Verification {
        @Builder.Default
        private Boolean isVerified = false;
        
        private Instant verifiedAt;
        private String verifiedBy;
        
        @Builder.Default
        private List<Document> documents = new ArrayList<>();
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Document {
        private DocumentType type;
        private String url;
        private Instant uploadedAt;
        private DocumentStatus status;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Statistics {
        @Builder.Default
        private Integer totalEvents = 0;
        
        @Builder.Default
        private Integer totalTicketsSold = 0;
        
        @Builder.Default
        private BigDecimal totalRevenue = BigDecimal.ZERO;
        
        @Builder.Default
        private Double averageRating = 0.0;
        
        @Builder.Default
        private Integer followerCount = 0;
    }
    
    // ========== Enums ==========
    
    public enum OrganizerType {
        INDIVIDUAL, COMPANY, NONPROFIT, GOVERNMENT
    }
    
    public enum OrganizerStatus {
        PENDING, ACTIVE, SUSPENDED, REJECTED
    }
    
    public enum DocumentType {
        BUSINESS_LICENSE, ID_CARD, BANK_STATEMENT, OTHER
    }
    
    public enum DocumentStatus {
        PENDING, APPROVED, REJECTED
    }
}
