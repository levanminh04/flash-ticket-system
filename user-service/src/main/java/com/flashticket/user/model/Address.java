package com.flashticket.user.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;


@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Address {
    private AddressType type;
    
    @Builder.Default
    private Boolean isDefault = false;
    
    private String street;
    private String ward;
    private String district;
    private String city;
    
    @Builder.Default
    private String country = "Vietnam";
    
    private String postalCode;
    
    public enum AddressType {
        HOME, WORK, BILLING, OTHER;

        @com.fasterxml.jackson.annotation.JsonCreator
        public static AddressType fromString(String value) {
            if (value == null || value.isBlank()) return null;
            return AddressType.valueOf(value.toUpperCase());
        }

        @com.fasterxml.jackson.annotation.JsonValue
        public String toValue() {
            return this.name();
        }
    }
}
