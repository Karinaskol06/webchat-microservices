package com.project.webchat.shared.dto;

import com.project.webchat.shared.validation.ValidEmailDomain;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ForgotPasswordRequestDTO {

    @NotBlank(message = "Email is required")
    @ValidEmailDomain
    private String email;
}
