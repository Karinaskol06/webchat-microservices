package com.project.webchat.chat.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class BootstrapMessageResponse {
    private String chatId;
    private ChatMessageDTO message;
    private boolean idempotentReplay;
}
