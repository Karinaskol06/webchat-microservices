package com.project.webchat.chat.dto;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.RoomVisibility;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class DiscoverableRoomDTO {
    private String id;
    private String type;
    private String visibility;
    private String groupName;
    private String groupPhoto;
    private int memberCount;
    private Long createdBy;

    public static DiscoverableRoomDTO fromRoom(ChatRoom room) {
        return DiscoverableRoomDTO.builder()
                .id(room.getId())
                .type(room.getType() != null ? room.getType().name() : null)
                .visibility(room.getVisibility() != null ? room.getVisibility().name() : RoomVisibility.PRIVATE.name())
                .groupName(room.getGroupName())
                .groupPhoto(room.getGroupPhoto())
                .memberCount(room.getMemberIds() != null ? room.getMemberIds().size() : 0)
                .createdBy(room.getCreatedBy())
                .build();
    }
}
