package com.project.webchat.shared.events.v1;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageCreatedEventV1 {

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
    private Long senderId;

    private String senderDisplayName;

    /**
     * Public avatar URL path (often {@code /api/users/{senderId}/avatar}) for notification icons.
     */
    private String senderAvatarUrl;

    @NotEmpty
    private List<Long> recipientUserIds;

    private String previewText;

    @NotNull
    private String messageType;
}
