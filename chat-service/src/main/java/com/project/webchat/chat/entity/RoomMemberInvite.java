package com.project.webchat.chat.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "room_member_invites")
@Builder
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoomMemberInvite {

    @Id
    private String id;

    private String roomId;
    private String roomName;
    private ChatType roomType;

    private Long invitedByUserId;
    private Long inviteeUserId;

    @Builder.Default
    private RoomMemberInviteState state = RoomMemberInviteState.PENDING;

    private LocalDateTime createdAt;
    private LocalDateTime respondedAt;
}
