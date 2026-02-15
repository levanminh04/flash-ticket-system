package com.flashticket.user.dto;

import com.flashticket.user.model.UserRole;
import lombok.Data;

@Data
public class UserResponse {
    private String id;
    private String keyCloakId;
    private String firstName;
    private String lastName;
    private String email;
    private String phone;
    private UserRole role;
    private AddressDTO address;
}
