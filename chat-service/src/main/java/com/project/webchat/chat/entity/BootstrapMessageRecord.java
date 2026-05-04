package com.project.webchat.chat.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "bootstrap_message_records")
@CompoundIndex(name = "uk_sender_request_key", def = "{'senderId': 1, 'clientRequestKey': 1}", unique = true)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BootstrapMessageRecord {
    @Id
    private String id;

    private Long senderId;
    private String clientRequestKey;
    private String chatId;
    private String messageId;
    private LocalDateTime createdAt;
}
