package com.project.webchat.user.dto;

import com.project.webchat.shared.validation.ValidEmailDomain;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UpdateAccountDTO {

    @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
    private String username;

    @ValidEmailDomain
    private String email;
}
