package com.project.webchat.chat.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.project.webchat.chat.entity.ChatMessage;
import com.project.webchat.chat.entity.MessageType;
import com.project.webchat.shared.dto.UserInfoDTO;
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
    private String content;
    private MessageType messageType;
    private LocalDateTime timestamp;
    private boolean isRead;
    private LocalDateTime readAt;

    //for websocket (MESSAGE, WRITING, READ_RECEIPT)
    private String type;

    private UserInfoDTO sender;

    public static ChatMessageDTO toDTO(ChatMessage chatMessage, UserInfoDTO sender) {
        return ChatMessageDTO.builder()
                .id(chatMessage.getId())
                .chatId(chatMessage.getChatId())
                .sender(sender)
                .content(chatMessage.getContent())
                .messageType(chatMessage.getMessageType())
                .timestamp(chatMessage.getTimestamp())
                .isRead(chatMessage.isRead())
                .readAt(chatMessage.getReadAt())
                .type("MESSAGE")
                .build();
    }

}
