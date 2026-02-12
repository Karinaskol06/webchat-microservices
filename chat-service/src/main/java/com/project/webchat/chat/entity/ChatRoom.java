package com.project.webchat.chat.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Document(collection = "chat_rooms")
@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatRoom {

    @Id
    private String id;

    private String name;

    private ChatType type;

    @Builder.Default
    private Set<Long> memberIds = new HashSet<>();

    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    //for preview
    private String lastMessage;

    @Builder.Default
    private LocalDateTime lastActivity = LocalDateTime.now();

    public void addMember(Long userId) {
        memberIds.add(userId);
    }

    public boolean isMember(Long userId) {
        return memberIds.contains(userId);
    }

}
