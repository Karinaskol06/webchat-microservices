package com.project.webchat.chat.dto;

import com.project.webchat.chat.entity.MessageType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReplyPreviewDTO {
    private String messageId;
    private Long senderId;
    private String senderDisplayName;
    private String content;
    private MessageType messageType;
    private boolean deleted;
}
