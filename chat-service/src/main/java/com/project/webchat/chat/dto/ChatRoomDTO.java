package com.project.webchat.chat.dto;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.entity.RoomVisibility;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.project.webchat.shared.dto.UserInfoDTO;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ChatRoomDTO {
    private String id;
    private String type;
    private String visibility;
    private LocalDateTime createdAt;
    private LocalDateTime lastActivity;
    private String lastMessage;
    private int unreadCount;
    private Long createdBy;
    @JsonProperty("isCurrentUserAdmin")
    private boolean currentUserAdmin;
    @JsonProperty("isCurrentUserChannelCreator")
    private boolean currentUserChannelCreator;
    /** CHANNEL: promoted moderator (in adminIds), not the creator. */
    @JsonProperty("isCurrentUserChannelAdmin")
    private boolean currentUserChannelAdmin;
    /** CHANNEL: member explicitly allowed to post (not creator / channel admin). */
    @JsonProperty("isCurrentUserChannelPoster")
    private boolean currentUserChannelPoster;
    private int memberCount;

    //for private chat
    private UserInfoDTO otherUser;

    //for group chats
    private String groupName;
    private String groupPhoto;
    private String description;
    /** GROUP: admin user ids. CHANNEL: promoted moderator user ids (excludes creator). */
    private List<Long> adminUserIds = new ArrayList<>();
    /** CHANNEL only: user ids with posting permission without being a channel admin. */
    private List<Long> channelPosterUserIds = new ArrayList<>();
    private List<UserInfoDTO> members;
    /** Present for moderators on GROUP / CHANNEL rooms. */
    private List<UserInfoDTO> bannedMembers;
    @JsonProperty("isCurrentUserCanModerateMembers")
    private boolean currentUserCanModerateMembers;

    public static ChatRoomDTO toDTO(ChatRoom chatRoom, Integer unreadCount) {
        ChatRoomDTOBuilder builder = ChatRoomDTO.builder()
                .id(chatRoom.getId())
                .createdAt(chatRoom.getCreatedAt())
                .type(chatRoom.getType().toString())
                .visibility(chatRoom.getVisibility() != null ? chatRoom.getVisibility().name() : RoomVisibility.PRIVATE.name())
                .lastActivity(chatRoom.getLastActivity())
                .lastMessage(chatRoom.getLastMessage())
                .unreadCount(unreadCount)
                .createdBy(chatRoom.getCreatedBy())
                .memberCount(chatRoom.getMemberIds() != null ? chatRoom.getMemberIds().size() : 0);

        if (chatRoom.getType() == ChatType.GROUP || chatRoom.getType() == ChatType.CHANNEL) {
            builder.groupName(chatRoom.getGroupName());
            builder.groupPhoto(chatRoom.getGroupPhoto());
            builder.description(chatRoom.getDescription());
        }

        return builder.build();
    }
}
