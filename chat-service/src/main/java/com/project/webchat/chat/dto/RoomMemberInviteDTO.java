package com.project.webchat.chat.dto;

import com.project.webchat.shared.dto.UserInfoDTO;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class RoomMemberInviteDTO {
    private String id;
    private String roomId;
    private String roomName;
    private String roomType;
    private Long invitedByUserId;
    private UserInfoDTO invitedBy;
    private String state;
    private LocalDateTime createdAt;
}
