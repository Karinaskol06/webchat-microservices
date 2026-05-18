package com.project.webchat.chat.dto.websocketDTOs;

import com.project.webchat.chat.dto.MessageReactionDTO;
import lombok.Getter;

import java.util.List;

@Getter
public class MessageReactionUpdatedEvent extends BaseWebsocketEvent {

    private final String messageId;
    private final String chatId;
    private final List<MessageReactionDTO> reactions;

    public MessageReactionUpdatedEvent(String messageId, String chatId, List<MessageReactionDTO> reactions) {
        super("MESSAGE_REACTION_UPDATED");
        this.messageId = messageId;
        this.chatId = chatId;
        this.reactions = reactions;
    }
}
