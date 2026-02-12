package com.project.webchat.chat.dto.websocketDTOs;

import lombok.Getter;

@Getter
public class MessageEditedEvent extends BaseWebsocketEvent {
    private final String messageId;
    private final String userId;
    private final String newContent;

    public MessageEditedEvent(String messageId, String userId, String newContent) {
        super("MESSAGE_EDITED");
        this.messageId = messageId;
        this.userId = userId;
        this.newContent = newContent;
    }
}
