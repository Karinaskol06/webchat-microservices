package com.project.webchat.chat.dto.websocketDTOs;

import lombok.Getter;

@Getter
public class MessageDeletedEvent extends BaseWebsocketEvent {
    private final String messageId;
    private final String chatId;
    private final Long deletedByUserId;

    public MessageDeletedEvent(String messageId, String chatId, Long deletedByUserId) {
        super("MESSAGE_DELETED");
        this.messageId = messageId;
        this.chatId = chatId;
        this.deletedByUserId = deletedByUserId;
    }
}
