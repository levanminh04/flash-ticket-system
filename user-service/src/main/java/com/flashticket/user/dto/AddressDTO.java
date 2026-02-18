package com.flashticket.user.dto;

import lombok.Data;

/**
 * DTO for Address - matches Address model fields
 * Note: Uses district/postalCode (not state/zipcode from old ecommerce project)
 */
@Data
public class AddressDTO {
    private String street;
    private String city;
    private String district;  // was "state" in old project
    private String country;
    private String postalCode; // was "zipcode" in old project
}
