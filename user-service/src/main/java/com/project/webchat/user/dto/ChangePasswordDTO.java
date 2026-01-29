package com.project.webchat.user.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ChangePasswordDTO {
    @NotBlank(message = "Current password is required")
    private String oldPassword;

    @NotBlank(message = "New password is required")
    @Size(min = 5, message = "Password must be longer than 5 symbols")
    private String newPassword;

    @NotBlank(message = "Repeat new password")
    private String repeatPassword;

    @AssertTrue(message = "New password and repeat password must match")
    public boolean isPasswordMatching() {
        if (newPassword == null) {
            return repeatPassword == null;
        }
        return newPassword.equals(repeatPassword);
    }
}
