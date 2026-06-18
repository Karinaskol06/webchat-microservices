package com.project.webchat.user.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class DeleteAccountDTO {

    @NotBlank(message = "Password is required")
    private String password;

    @NotBlank(message = "Username confirmation is required")
    private String confirmUsername;
}
