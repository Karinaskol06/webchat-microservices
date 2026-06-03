package com.project.webchat.chat.service;

import com.project.webchat.chat.entity.ChatMessage;
import com.project.webchat.chat.entity.RoomMemberInvite;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import com.project.webchat.shared.dto.UserInfoDTO;
import com.project.webchat.shared.events.v1.MessageReactionEventV1;
import com.project.webchat.shared.events.v1.RoomMemberInvitedEventV1;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class ChatNotificationEventPublisher {

    private static final int MESSAGE_PREVIEW_MAX_LENGTH = 120;

    private final MessageEventPublisher messageEventPublisher;
    private final ChatUserInfoService chatUserInfoService;

    public void publishMessageReactionAdded(ChatMessage message, Long reactorUserId, String emoji) {
        Long messageSenderId = message.getSenderId();
        if (messageSenderId == null || Objects.equals(messageSenderId, reactorUserId)) {
            log.debug("Skipping message-reaction event for message {} — no external recipient",
                    message.getId());
            return;
        }

        UserInfoDTO reactor = chatUserInfoService.getUserInfo(reactorUserId);
        String reactorDisplayName = reactor != null && reactor.getDisplayName() != null
                ? reactor.getDisplayName()
                : "Someone";
        String reactorAvatarUrl = reactor != null ? reactor.getProfilePicture() : null;

        MessageReactionEventV1 event = MessageReactionEventV1.builder()
                .eventId(UUID.randomUUID())
                .occurredAt(Instant.now())
                .schemaVersion(MessageReactionEventV1.SCHEMA_VERSION_V1)
                .chatId(message.getChatId())
                .messageId(message.getId())
                .messageSenderId(messageSenderId)
                .reactorUserId(reactorUserId)
                .reactorDisplayName(reactorDisplayName)
                .reactorAvatarUrl(reactorAvatarUrl)
                .emoji(emoji)
                .recipientUserIds(List.of(messageSenderId))
                .messagePreviewText(truncatePreview(message.getContent()))
                .build();

        messageEventPublisher.publishMessageReaction(event);
    }

    public void publishRoomMemberInvited(RoomMemberInvite invite) {
        UserInfoDTO inviter = chatUserInfoService.getUserInfo(invite.getInvitedByUserId());
        String inviterDisplayName = inviter != null && inviter.getDisplayName() != null
                ? inviter.getDisplayName()
                : "Someone";
        String inviterAvatarUrl = inviter != null ? inviter.getProfilePicture() : null;

        RoomMemberInvitedEventV1 event = RoomMemberInvitedEventV1.builder()
                .eventId(UUID.randomUUID())
                .occurredAt(Instant.now())
                .schemaVersion(RoomMemberInvitedEventV1.SCHEMA_VERSION_V1)
                .inviteId(invite.getId())
                .roomId(invite.getRoomId())
                .roomName(invite.getRoomName())
                .roomType(invite.getRoomType() != null ? invite.getRoomType().name() : null)
                .inviterUserId(invite.getInvitedByUserId())
                .inviterDisplayName(inviterDisplayName)
                .inviterAvatarUrl(inviterAvatarUrl)
                .inviteeUserId(invite.getInviteeUserId())
                .build();

        messageEventPublisher.publishRoomMemberInvited(event);
    }

    private static String truncatePreview(String content) {
        if (content == null || content.isBlank()) {
            return null;
        }
        String trimmed = content.trim();
        if (trimmed.length() <= MESSAGE_PREVIEW_MAX_LENGTH) {
            return trimmed;
        }
        return trimmed.substring(0, MESSAGE_PREVIEW_MAX_LENGTH - 1) + "…";
    }
}
