package com.project.webchat.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class BootstrapMessageRequest {
    @NotNull(message = "Recipient user ID is required")
    private Long recipientUserId;

    @NotBlank(message = "Message content cannot be blank")
    private String content;

    @NotBlank(message = "Client request key is required")
    private String clientRequestKey;
}
