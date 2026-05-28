package com.project.webchat.chat.dto;

import com.project.webchat.chat.entity.MessageType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SendRichMessageRequest {

    @NotNull
    private MessageType type;

    /** JSON payload for the rich message (todo list, sticky note, callout, divider). */
    @NotBlank
    private String content;

    private String replyToMessageId;
}
