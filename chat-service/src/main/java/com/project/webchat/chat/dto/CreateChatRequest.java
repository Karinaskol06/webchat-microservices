package com.project.webchat.chat.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
@Data
public class CreateChatRequest {
    @NotNull(message = "User ID is required")
    Long otherUserId;
}
