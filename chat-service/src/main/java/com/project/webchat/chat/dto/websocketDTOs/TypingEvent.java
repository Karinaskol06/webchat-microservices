package com.project.webchat.chat.dto.websocketDTOs;

import lombok.Getter;

@Getter
public class TypingEvent extends BaseWebsocketEvent {
    private final Long userId;
    private final boolean isTyping;

    public TypingEvent(Long userId, boolean isTyping) {
        super("TYPING");
        this.userId = userId;
        this.isTyping = isTyping;
    }
}
