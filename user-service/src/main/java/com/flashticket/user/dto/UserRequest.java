package com.flashticket.user.dto;

import lombok.Data;

/**
 * Request DTO for creating/updating a User
 */
@Data
public class UserRequest {
    private String username;
    private String firstName;
    private String lastName;
    private String password;
    private String email;
    private String phone;
    private AddressDTO address;
}
