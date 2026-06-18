package com.project.webchat.chat.dto.websocketDTOs;

import lombok.Getter;

@Getter
public class ChatRoomDeletedEvent extends BaseWebsocketEvent {
    private final String chatId;

    public ChatRoomDeletedEvent(String chatId) {
        super("CHAT_DELETED");
        this.chatId = chatId;
    }
}
