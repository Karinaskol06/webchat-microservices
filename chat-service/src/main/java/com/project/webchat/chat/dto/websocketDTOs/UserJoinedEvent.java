package com.project.webchat.chat.dto.websocketDTOs;

import lombok.Getter;

@Getter
public class UserJoinedEvent extends BaseWebsocketEvent {
    private final Long userId;

    public UserJoinedEvent(Long userId) {
        super("USER_JOINED");
        this.userId = userId;
    }
}
