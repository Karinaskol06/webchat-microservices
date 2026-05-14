package com.project.webchat.user.dto;

import com.project.webchat.shared.validation.InternationalPhone;
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
public class UpdateUserDTO {
    @Size(max = 50, message = "First name can be at most 50 characters")
    private String firstName;

    @Size(max = 50, message = "Last name can be at most 50 characters")
    private String lastName;

    @Size(max = 500, message = "Description can be at most 500 characters")
    private String description;

    private LocalDate birthday;

    @Size(max = 16, message = "Phone number exceeds maximum length")
    @InternationalPhone
    private String phoneNumber;

    private String countryCode;
}
