package com.project.webchat.shared.dto;

import com.project.webchat.shared.validation.InternationalPhone;
import com.project.webchat.shared.validation.ValidEmailDomain;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UserDTO {
    private Long id;

    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
    private String username;

    @ValidEmailDomain
    private String email;

    private String firstName;
    private String lastName;
    private String profilePicture;
    private String backgroundPicture;
    private String description;
    private LocalDate birthday;

    @InternationalPhone
    private String phoneNumber;

    private String countryCode;

    private boolean active = true;

    private boolean deleted;

}
