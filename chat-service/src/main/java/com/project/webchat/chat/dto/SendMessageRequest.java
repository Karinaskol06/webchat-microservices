package com.project.webchat.chat.dto;

import com.project.webchat.chat.entity.MessageType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SendMessageRequest {

    @NotNull(message = "Chat ID cannot be null")
    private String chatId;

    @NotBlank
    private String content;

    //TEXT, ATTACHMENT, MIXED
    private MessageType type = MessageType.TEXT;
}
