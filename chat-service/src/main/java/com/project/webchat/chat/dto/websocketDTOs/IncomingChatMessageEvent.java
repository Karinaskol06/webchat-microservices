package com.project.webchat.chat.dto.websocketDTOs;

import com.project.webchat.chat.dto.ChatMessageDTO;
import com.project.webchat.chat.dto.ChatRoomDTO;
import lombok.Getter;

@Getter
public class IncomingChatMessageEvent extends BaseWebsocketEvent {
    private final ChatRoomDTO chat;
    private final ChatMessageDTO message;

    public IncomingChatMessageEvent(ChatRoomDTO chat, ChatMessageDTO message) {
        super("INCOMING_CHAT_MESSAGE");
        this.chat = chat;
        this.message = message;
    }
}
