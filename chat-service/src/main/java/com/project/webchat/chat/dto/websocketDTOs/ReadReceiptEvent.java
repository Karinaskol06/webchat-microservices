package com.project.webchat.chat.dto.websocketDTOs;

import java.util.List;
import lombok.Getter;

@Getter
public class ReadReceiptEvent extends BaseWebsocketEvent {
    private final Long userId;
    private final String messageId;
    private final List<String> messageIds;

    public ReadReceiptEvent(Long userId, String messageId, List<String> messageIds) {
        super("READ_RECEIPT");
        this.userId = userId;
        this.messageId = messageId;
        this.messageIds = messageIds;
    }
}
