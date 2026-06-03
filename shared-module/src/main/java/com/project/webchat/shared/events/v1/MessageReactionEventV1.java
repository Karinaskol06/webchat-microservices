package com.project.webchat.shared.events.v1;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageReactionEventV1 {

    public static final String SCHEMA_VERSION_V1 = "v1";

    @NotNull
    private UUID eventId;

    @NotNull
    private Instant occurredAt;

    @NotNull
    private String schemaVersion;

    @NotNull
    private String chatId;

    @NotNull
    private String messageId;

    @NotNull
    private Long messageSenderId;

    @NotNull
    private Long reactorUserId;

    private String reactorDisplayName;

    /**
     * Public avatar URL path for notification icons.
     */
    private String reactorAvatarUrl;

    @NotNull
    private String emoji;

    @NotEmpty
    private List<Long> recipientUserIds;

    private String messagePreviewText;
}
