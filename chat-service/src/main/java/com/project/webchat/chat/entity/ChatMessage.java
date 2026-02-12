package com.project.webchat.chat.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDateTime;

@Document(collection = "messages")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessage {

    @Id
    private String id;

    @Indexed
    private String chatId;

    @Indexed
    private Long senderId;

    private String senderName;

    private String content;

    private MessageType messageType;

    @Indexed
    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();

    private boolean isRead;

    @Indexed
    @Builder.Default
    private LocalDateTime readAt = null;
}
