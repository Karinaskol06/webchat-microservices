package com.project.webchat.shared.events.v1;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomMemberInvitedEventV1 {

    public static final String SCHEMA_VERSION_V1 = "v1";

    @NotNull
    private UUID eventId;

    @NotNull
    private Instant occurredAt;

    @NotNull
    private String schemaVersion;

    @NotNull
    private String inviteId;

    @NotNull
    private String roomId;

    private String roomName;

    private String roomType;

    @NotNull
    private Long inviterUserId;

    private String inviterDisplayName;

    private String inviterAvatarUrl;

    @NotNull
    private Long inviteeUserId;
}
