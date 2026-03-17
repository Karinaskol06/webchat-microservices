package com.project.webchat.chat.dto;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.shared.dto.UserInfoDTO;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ChatRoomDTO {
    private String id;
    private String type; //PRIVATE, GROUP
    private LocalDateTime createdAt;
    private LocalDateTime lastActivity;
    private String lastMessage;
    private int unreadCount;

    //for private chat
    private UserInfoDTO otherUser;

    //for group chats
    private String groupName;
    private String groupPhoto;
    private List<UserInfoDTO> members;

    public static ChatRoomDTO toDTO(ChatRoom chatRoom, Integer unreadCount) {
        ChatRoomDTOBuilder builder = ChatRoomDTO.builder()
                .id(chatRoom.getId())
                .createdAt(chatRoom.getCreatedAt())
                .type(chatRoom.getType().toString())
                .lastActivity(chatRoom.getLastActivity())
                .lastMessage(chatRoom.getLastMessage())
                .unreadCount(unreadCount);

        if (chatRoom.getType() == ChatType.GROUP) {
            builder.groupName(chatRoom.getGroupName());
            builder.groupPhoto(chatRoom.getGroupPhoto());
        }

        return builder.build();
    }
}
