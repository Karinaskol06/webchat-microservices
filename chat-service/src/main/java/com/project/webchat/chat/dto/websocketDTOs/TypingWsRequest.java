package com.project.webchat.chat.dto.websocketDTOs;

import lombok.Data;

@Data
public class TypingWsRequest {
    private String chatId;
    private boolean typing = true;
}
