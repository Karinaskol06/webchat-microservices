package com.project.webchat.chat.dto.websocketDTOs;

import lombok.Getter;

@Getter
public class MessageDeletedEvent extends BaseWebsocketEvent {
    private final String messageId;
    private final String chatId;

    public MessageDeletedEvent(String messageId, String chatId) {
        super("MESSAGE_DELETED");
        this.messageId = messageId;
        this.chatId = chatId;
    }
}
