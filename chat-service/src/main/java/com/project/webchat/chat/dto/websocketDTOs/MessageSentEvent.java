package com.project.webchat.chat.dto.websocketDTOs;

import com.project.webchat.chat.dto.ChatMessageDTO;
import lombok.Getter;

@Getter
public class MessageSentEvent extends BaseWebsocketEvent {
    private final ChatMessageDTO message;

    public MessageSentEvent(ChatMessageDTO message) {
        super("MESSAGE_SENT");
        this.message = message;
    }

}
