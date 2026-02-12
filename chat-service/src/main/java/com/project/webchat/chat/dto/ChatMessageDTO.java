package com.project.webchat.chat.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.project.webchat.chat.entity.ChatMessage;
import com.project.webchat.chat.entity.MessageType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ChatMessageDTO {
    private String id;
    private String chatId;
    private Long senderId;
    private String senderName;
    private String content;
    private MessageType messageType;
    private LocalDateTime timestamp;
    private boolean isRead;
    private LocalDateTime readAt;

    //for websocket (MESSAGE, WRITING, READ_RECEIPT)
    private String type;

    public static ChatMessageDTO toDTO(ChatMessage chatMessage) {
        return ChatMessageDTO.builder()
                .id(chatMessage.getId())
                .chatId(chatMessage.getChatId())
                .senderId(chatMessage.getSenderId())
                .senderName(chatMessage.getSenderName())
                .content(chatMessage.getContent())
                .messageType(chatMessage.getMessageType())
                .timestamp(chatMessage.getTimestamp())
                .isRead(chatMessage.isRead())
                .readAt(chatMessage.getReadAt())
                .type("MESSAGE")
                .build();
    }

}
