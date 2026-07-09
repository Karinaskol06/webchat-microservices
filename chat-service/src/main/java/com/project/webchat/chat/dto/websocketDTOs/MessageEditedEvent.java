package com.project.webchat.chat.dto.websocketDTOs;

import com.project.webchat.chat.entity.MessageType;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class MessageEditedEvent extends BaseWebsocketEvent {
    private final String messageId;
    private final String chatId;
    private final String newContent;
    private final Long editedByUserId;
    private final LocalDateTime editedAt;
    private final MessageType messageType;

    public MessageEditedEvent(
            String messageId,
            String chatId,
            String newContent,
            Long editedByUserId,
            LocalDateTime editedAt,
            MessageType messageType) {
        super("MESSAGE_EDITED");
        this.messageId = messageId;
        this.chatId = chatId;
        this.newContent = newContent;
        this.editedByUserId = editedByUserId;
        this.editedAt = editedAt;
        this.messageType = messageType;
    }
}
