package com.project.webchat.chat.dto.websocketDTOs;

import lombok.Getter;

import java.time.Instant;

@Getter
public abstract class BaseWebsocketEvent {
    private final String type;
    private final String timestamp;

    protected BaseWebsocketEvent(String type) {
        this.type = type;
        this.timestamp = Instant.now().toString();
    }
}
