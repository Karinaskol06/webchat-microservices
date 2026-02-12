package com.project.webchat.chat.dto.websocketDTOs;

import lombok.Getter;

@Getter
public class UserLeftEvent extends BaseWebsocketEvent {
    private final Long userId;

    public UserLeftEvent(Long userId) {
        super("USER_LEFT");
        this.userId = userId;
    }
}