package com.project.webchat.chat.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AdminMutationRequest {

    @NotNull(message = "User id is required")
    private Long userId;

    @NotNull(message = "Action is required")
    private AdminAction action;
}
