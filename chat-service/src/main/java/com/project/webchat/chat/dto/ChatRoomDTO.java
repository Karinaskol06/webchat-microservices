package com.project.webchat.chat.dto;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Set;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ChatRoomDTO {
    private String id;
    private String name;
    private String type; //PRIVATE, GROUP
    private LocalDateTime createdAt;
    private LocalDateTime lastActivity;
    private String lastMessage;
    private int unreadCount;

    private Set<ChatParticipantDTO> participants;

    public static ChatRoomDTO toDTO(ChatRoom chatRoom, Integer unreadCount) {
        return ChatRoomDTO.builder()
                .id(chatRoom.getId())
                .name(chatRoom.getName())
                .createdAt(chatRoom.getCreatedAt())
                .type(chatRoom.getType().toString())
                .lastActivity(chatRoom.getLastActivity())
                .lastMessage(chatRoom.getLastMessage())
                .unreadCount(unreadCount)
                .build();
    }
}
