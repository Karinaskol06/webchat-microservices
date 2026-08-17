package com.project.webchat.chat.service.message;

import com.project.webchat.chat.dto.ChatMessageDTO;
import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.entity.ChatMessage;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.MessageType;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.MessageEventPublisher;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.WebSocketService;
import com.project.webchat.chat.service.room.ChatRoomQueryService;
import com.project.webchat.chat.service.support.ChatRoomEnrichmentService;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import com.project.webchat.chat.service.user.PrivateChatContactRequestService;
import com.project.webchat.shared.dto.UserInfoDTO;
import com.project.webchat.shared.events.v1.MessageCreatedEventV1;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Outbound pipeline for message lifecycle events.
 * Owns Kafka push eligibility, WebSocket fan-out, and reveal-on-send
 * so {@link ChatMessageCommandService} stays focused on validate → write → map.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatMessageDeliveryService {

    private final ChatRoomRepository chatRoomRepository;
    private final RedisService redisService;
    private final WebSocketService webSocketService;
    private final MessageEventPublisher messageEventPublisher;
    private final ChatUserInfoService chatUserInfoService;
    private final ChatRoomEnrichmentService roomEnrichmentService;
    private final PrivateChatContactRequestService privateChatContactRequestService;
    private final ChatRoomQueryService chatRoomQueryService;

    /**
     * After a message is persisted: push + WS fan-out, then un-hide the chat for members.
     */
    public void notifyMessageCreated(
            ChatRoom room,
            Long senderId,
            ChatMessage savedMessage,
            ChatMessageDTO messageDTO,
            String previewText) {
        if (savedMessage != null) {
            publishMessageCreatedV1(savedMessage, previewText);
        }
        deliverSentMessage(room, senderId, messageDTO);
        revealChatAfterActivity(room, savedMessage, messageDTO);
    }

    public void notifyMessageEdited(
            String messageId,
            String chatId,
            String newContent,
            Long editedByUserId,
            LocalDateTime editedAt,
            MessageType newMessageType,
            Collection<Long> memberIds) {
        webSocketService.notifyMessageEdited(
                messageId, chatId, newContent, editedByUserId, editedAt, newMessageType, memberIds);
    }

    public void notifyMessageDeleted(
            String messageId, String chatId, Long deletedByUserId, Collection<Long> memberIds) {
        webSocketService.notifyMessageDeleted(messageId, chatId, deletedByUserId, memberIds);
    }

    public void notifyReaderPresent(String chatId, Long userId) {
        webSocketService.notifyUserJoinedChat(chatId, userId);
    }

    public void notifyReadReceipt(String chatId, Long readerId, List<String> messageIds) {
        webSocketService.sendReadReceipt(chatId, readerId, messageIds);
    }

    private void revealChatAfterActivity(ChatRoom room, ChatMessage savedMessage, ChatMessageDTO messageDTO) {
        String chatId = null;
        if (room != null && room.getId() != null && !room.getId().isBlank()) {
            chatId = room.getId();
        } else if (savedMessage != null && savedMessage.getChatId() != null) {
            chatId = savedMessage.getChatId();
        } else if (messageDTO != null && messageDTO.getChatId() != null) {
            chatId = messageDTO.getChatId();
        }
        if (chatId == null || chatId.isBlank()) {
            return;
        }
        chatRoomQueryService.revealChatOnNewMessage(chatId);
    }

    private void deliverSentMessage(ChatRoom room, Long senderId, ChatMessageDTO messageDTO) {
        if (room == null || room.getId() == null || messageDTO == null) {
            if (messageDTO != null && messageDTO.getChatId() != null) {
                webSocketService.sendMessageToChat(messageDTO.getChatId(), messageDTO);
            }
            return;
        }
        privateChatContactRequestService.maybeCreateContactRequestForPrivateMessage(room, senderId);
        webSocketService.sendMessageToChat(room.getId(), messageDTO);
        webSocketService.notifyUserJoinedChat(room.getId(), senderId);
        try {
            roomEnrichmentService.notifyRoomMembersChatUpdated(room);
        } catch (Exception ex) {
            log.warn("Failed to refresh room sidebar for chat {} after message {}: {}",
                    room.getId(), messageDTO.getId(), ex.getMessage());
        }
        if (room.getMemberIds() == null || room.getMemberIds().isEmpty()) {
            return;
        }
        for (Long memberId : room.getMemberIds()) {
            if (memberId == null || memberId.equals(senderId)) {
                continue;
            }
            int unread = roomEnrichmentService.getUnreadCount(room.getId(), memberId);
            ChatRoomDTO chatDto = roomEnrichmentService.enrichChatWithUserData(room, memberId, unread);
            webSocketService.notifyIncomingChatMessage(memberId, chatDto, messageDTO);
        }
    }

    private void publishMessageCreatedV1(ChatMessage savedMessage, String previewText) {
        ChatRoom room = chatRoomRepository.findById(savedMessage.getChatId())
                .orElseThrow(() -> new IllegalStateException(
                        "Chat room not found for message " + savedMessage.getId()));

        List<Long> recipientIds = room.getMemberIds().stream()
                .filter(memberId -> !memberId.equals(savedMessage.getSenderId()))
                .filter(memberId -> !shouldSkipPushBecauseClientIsViewingChat(memberId, savedMessage.getChatId()))
                .toList();

        if (recipientIds.isEmpty()) {
            log.debug("Skipping message-created event for message {} because no recipients need push",
                    savedMessage.getId());
            return;
        }

        UserInfoDTO senderDto = chatUserInfoService.getUserInfo(savedMessage.getSenderId());
        String senderAvatarUrl = senderDto != null ? senderDto.getProfilePicture() : null;

        MessageCreatedEventV1 event = MessageCreatedEventV1.builder()
                .eventId(UUID.randomUUID())
                .occurredAt(Instant.now())
                .schemaVersion(MessageCreatedEventV1.SCHEMA_VERSION_V1)
                .chatId(savedMessage.getChatId())
                .messageId(savedMessage.getId())
                .senderId(savedMessage.getSenderId())
                .senderDisplayName(savedMessage.getSenderName())
                .senderAvatarUrl(senderAvatarUrl)
                .recipientUserIds(recipientIds)
                .previewText(previewText)
                .messageType((savedMessage.getMessageType() != null
                        ? savedMessage.getMessageType()
                        : MessageType.TEXT).name())
                .build();

        messageEventPublisher.publishMessageCreated(event);
    }

    /**
     * Skip web push only when the recipient is actively viewing this chat (not AFK).
     * Other chats still get push; the WebSocket path handles in-app toasts when visible.
     */
    private boolean shouldSkipPushBecauseClientIsViewingChat(Long userId, String chatId) {
        if (userId == null || chatId == null || chatId.isBlank()) {
            return false;
        }
        if (!redisService.isUserOnline(userId)) {
            return false;
        }
        if (redisService.isUserAfk(userId)) {
            return false;
        }
        return chatId.equals(redisService.getCurrentChat(userId));
    }
}
