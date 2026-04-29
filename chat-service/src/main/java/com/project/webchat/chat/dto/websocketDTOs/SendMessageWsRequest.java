package com.project.webchat.chat.dto.websocketDTOs;

import com.project.webchat.chat.entity.MessageType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;
import lombok.NonNull;

import java.util.List;

@Data
@Builder
public class SendMessageWsRequest {
    @NotBlank(message = "Chat id is required")
    private String chatId;
    @NotNull(message = "Sender id is required")
    private Long senderId;
    private String content; // may be null
    private MessageType type;
    private List<String> attachmentIds;

    public boolean hasContent() {
        return content != null && !content.isBlank();
    }

    public boolean hasAttachments() {
        return attachmentIds != null && !attachmentIds.isEmpty();
    }

    public boolean isValid() {
        return hasContent() || hasAttachments();
    }
}
