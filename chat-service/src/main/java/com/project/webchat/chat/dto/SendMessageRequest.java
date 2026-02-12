package com.project.webchat.chat.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SendMessageRequest {

    @NotBlank
    private String chatId;

    @NotBlank
    private String content;

    //TEXT, IMAGE, FILE
    private String messageType;
}
