package com.project.webchat.chat.dto.websocketDTOs;

import com.project.webchat.chat.dto.ChatRoomDTO;
import lombok.Getter;

@Getter
public class ChatRoomCreatedEvent extends BaseWebsocketEvent {
    private final ChatRoomDTO chat;

    public ChatRoomCreatedEvent(ChatRoomDTO chat) {
        super("CHAT_CREATED");
        this.chat = chat;
    }
}
