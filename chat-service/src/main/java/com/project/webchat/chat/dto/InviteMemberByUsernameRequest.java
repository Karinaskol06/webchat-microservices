package com.project.webchat.chat.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class InviteMemberByUsernameRequest {

    @NotBlank(message = "Username is required")
    private String username;
}
