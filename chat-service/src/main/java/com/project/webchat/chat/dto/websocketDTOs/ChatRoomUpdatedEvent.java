package com.project.webchat.chat.dto.websocketDTOs;

import com.project.webchat.chat.dto.ChatRoomDTO;
import lombok.Getter;

@Getter
public class ChatRoomUpdatedEvent extends BaseWebsocketEvent {
    private final ChatRoomDTO chat;

    public ChatRoomUpdatedEvent(ChatRoomDTO chat) {
        super("CHAT_UPDATED");
        this.chat = chat;
    }
}
