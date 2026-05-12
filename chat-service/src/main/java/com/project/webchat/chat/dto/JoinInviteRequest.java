package com.project.webchat.chat.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class JoinInviteRequest {

    @NotBlank(message = "Invite token is required")
    private String token;
}
