package com.project.webchat.chat.dto.websocketDTOs;

import lombok.Getter;

@Getter
public class ReadReceiptEvent extends BaseWebsocketEvent {
    private final Long userId;
    private final String messageId;

    public ReadReceiptEvent(Long userId, String messageId) {
        super("READ_RECEIPT");
        this.userId = userId;
        this.messageId = messageId;
    }
}
