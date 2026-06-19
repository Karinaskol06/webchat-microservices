package com.project.webchat.chat.service.message;

import com.project.webchat.chat.dto.AttachmentDTO;
import com.project.webchat.chat.dto.ChatMessageDTO;
import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.dto.MessageWithAttachmentsDTO;
import com.project.webchat.chat.dto.SendMessageRequest;
import com.project.webchat.chat.entity.Attachment;
import com.project.webchat.chat.entity.ChatMessage;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.entity.MessageType;
import com.project.webchat.chat.exception.ForbiddenChatOperationException;
import com.project.webchat.chat.repository.AttachmentRepository;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.FileStorageService;
import com.project.webchat.chat.service.MessageEventPublisher;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.WebSocketService;
import com.project.webchat.chat.service.support.ChatMessageMapper;
import com.project.webchat.chat.service.support.ChatMessagePreviewHelper;
import com.project.webchat.chat.service.support.ChatRoomEnrichmentService;
import com.project.webchat.chat.service.support.ChatRoomPermissionService;
import com.project.webchat.chat.service.support.PersonalSpacePayloadValidator;
import com.project.webchat.chat.service.support.PollPayloadHelper;
import com.project.webchat.chat.service.support.SharedPollService;
import com.project.webchat.chat.service.support.UserBanGuardService;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import com.project.webchat.chat.service.user.PrivateChatContactRequestService;
import com.project.webchat.shared.dto.UserInfoDTO;
import com.project.webchat.shared.events.v1.MessageCreatedEventV1;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatMessageCommandService {

    private final ChatMessageRepository chatMessageRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final AttachmentRepository attachmentRepository;
    private final RedisService redisService;
    private final WebSocketService webSocketService;
    private final MessageEventPublisher messageEventPublisher;
    private final FileStorageService fileStorageService;
    private final ChatUserInfoService chatUserInfoService;
    private final ChatMessageMapper chatMessageMapper;
    private final ChatMessagePreviewHelper previewHelper;
    private final ChatRoomPermissionService roomPermissionService;
    private final ChatRoomEnrichmentService roomEnrichmentService;
    private final PersonalSpacePayloadValidator personalSpacePayloadValidator;
    private final PollPayloadHelper pollPayloadHelper;
    private final SharedPollService sharedPollService;
    private final UserBanGuardService userBanGuardService;
    private final PrivateChatContactRequestService privateChatContactRequestService;

    @Transactional
    public ChatMessageDTO sendRichMessage(Long senderId, String chatId, MessageType type,
                                          String content, String replyToMessageId) {
        if (!PersonalSpacePayloadValidator.isRichMessageType(type)) {
            throw new IllegalArgumentException("Unsupported rich message type.");
        }
        String normalized = content == null ? "" : content.trim();
        if (type == MessageType.POLL) {
            normalized = pollPayloadHelper.ensurePollId(normalized, null);
        }
        personalSpacePayloadValidator.validate(type, normalized);

        if (!isUserChatMember(chatId, senderId)) {
            throw new IllegalArgumentException("User is not a member of this chat.");
        }
        ChatRoom room = chatRoomRepository.findById(chatId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));
        if (type == MessageType.POLL) {
            assertPollAllowedInRoom(room);
        }
        roomPermissionService.assertCanPostMessage(room, senderId);

        UserInfoDTO senderInfo = chatUserInfoService.getUserInfo(senderId);
        ChatMessage chatMessage = ChatMessage.builder()
                .chatId(chatId)
                .messageType(type)
                .content(normalized)
                .replyToMessageId(chatMessageMapper.normalizeReplyToMessageId(replyToMessageId))
                .senderId(senderId)
                .senderName(senderInfo.getDisplayName())
                .timestamp(LocalDateTime.now())
                .isRead(false)
                .build();
        ChatMessage saved = chatMessageRepository.save(chatMessage);
        String preview = previewHelper.getPreviewText(normalized, List.of(), type);
        publishMessageCreatedV1(saved, preview);
        updateChatLastActivity(chatId, preview);
        redisService.updatePresence(senderId, chatId);
        ChatMessageDTO messageDTO = chatMessageMapper.toMessageDTO(saved, senderInfo);
        deliverSentMessage(room, senderId, messageDTO);
        return messageDTO;
    }

    @Transactional
    public ChatMessageDTO sendMessage(Long senderId, SendMessageRequest sendMessageRequest) {
        if (!isUserChatMember(sendMessageRequest.getChatId(), senderId)) {
            throw new IllegalArgumentException("User is not a member of this chat.");
        }

        ChatRoom room = chatRoomRepository.findById(sendMessageRequest.getChatId())
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));
        roomPermissionService.assertCanPostMessage(room, senderId);

        UserInfoDTO senderInfo = chatUserInfoService.getUserInfo(senderId);

        ChatMessage chatMessage = ChatMessage.builder()
                .chatId(sendMessageRequest.getChatId())
                .messageType(sendMessageRequest.getType() != null ? sendMessageRequest.getType() : MessageType.TEXT)
                .content(sendMessageRequest.getContent())
                .replyToMessageId(chatMessageMapper.normalizeReplyToMessageId(sendMessageRequest.getReplyToMessageId()))
                .senderId(senderId)
                .senderName(senderInfo.getDisplayName())
                .timestamp(LocalDateTime.now())
                .isRead(false)
                .build();
        ChatMessage saved = chatMessageRepository.save(chatMessage);
        publishMessageCreatedV1(saved, previewHelper.getPreviewText(sendMessageRequest.getContent(), List.of()));

        updateChatLastActivity(sendMessageRequest.getChatId(), sendMessageRequest.getContent());
        redisService.updatePresence(senderId, sendMessageRequest.getChatId());
        ChatMessageDTO messageDTO = chatMessageMapper.toMessageDTO(saved, senderInfo);
        deliverSentMessage(room, senderId, messageDTO);
        return messageDTO;
    }

    @Transactional
    public ChatMessageDTO forwardMessage(Long senderId, String targetChatId, String forwardSourceMessageId) {
        if (forwardSourceMessageId == null || forwardSourceMessageId.isBlank()) {
            throw new IllegalArgumentException("Forward source message is required.");
        }
        String sourceId = forwardSourceMessageId.trim();
        ChatMessage source = chatMessageRepository.findById(sourceId)
                .orElseThrow(() -> new IllegalArgumentException("Forwarded message was not found."));
        validateForwardAccess(senderId, targetChatId, source);
        ChatRoom targetRoom = chatRoomRepository.findById(targetChatId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));
        roomPermissionService.assertCanPostMessage(targetRoom, senderId);

        List<Attachment> sourceAttachments = chatMessageMapper.collectAttachmentsForMessage(source);
        String rawContent = source.getContent();
        boolean hasText = rawContent != null && !rawContent.isBlank();
        boolean hasAttachments = !sourceAttachments.isEmpty();
        MessageType sourceType = source.getMessageType() != null ? source.getMessageType() : MessageType.TEXT;
        boolean isRich = PersonalSpacePayloadValidator.isRichMessageType(sourceType);
        if (!hasText && !hasAttachments && !isRich) {
            throw new IllegalArgumentException("Nothing to forward.");
        }

        MessageType type;
        if (isRich) {
            type = sourceType;
        } else if (hasText && hasAttachments) {
            type = MessageType.MIXED;
        } else if (hasText) {
            type = MessageType.TEXT;
        } else {
            type = sourceType != MessageType.TEXT ? sourceType : MessageType.ATTACHMENT;
        }

        UserInfoDTO senderInfo = chatUserInfoService.getUserInfo(senderId);
        ChatMessageMapper.ForwardOrigin forwardOrigin = chatMessageMapper.buildForwardOriginFromSource(source);
        String contentToSave = hasText ? rawContent : null;
        if (type == MessageType.POLL && contentToSave != null) {
            contentToSave = sharedPollService.prepareForwardPollContent(source);
        }
        ChatMessage saved = chatMessageRepository.save(ChatMessage.builder()
                .chatId(targetChatId)
                .senderId(senderId)
                .senderName(senderInfo.getDisplayName())
                .content(contentToSave)
                .replyToMessageId(null)
                .messageType(type)
                .timestamp(LocalDateTime.now())
                .isRead(false)
                .forwardedFromUserId(forwardOrigin.isRoom() ? null : forwardOrigin.userId())
                .forwardedFromUsername(forwardOrigin.username())
                .forwardedFromRoomId(forwardOrigin.isRoom() ? forwardOrigin.roomId() : null)
                .forwardedFromRoomType(forwardOrigin.isRoom() && forwardOrigin.roomType() != null
                        ? forwardOrigin.roomType().name()
                        : null)
                .forwardedFromRoomVisibility(forwardOrigin.isRoom() ? forwardOrigin.roomVisibility() : null)
                .build());

        List<Attachment> newAttachments = new ArrayList<>();
        for (Attachment att : sourceAttachments) {
            Attachment clone = fileStorageService.cloneAttachmentForForward(att, saved.getId(),
                    targetChatId, senderId);
            newAttachments.add(clone);
        }
        updateChatLastActivity(targetChatId,
                previewHelper.getPreviewText(saved.getContent(), newAttachments, saved.getMessageType()));
        publishMessageCreatedV1(saved,
                previewHelper.getPreviewText(saved.getContent(), newAttachments, saved.getMessageType()));
        redisService.updatePresence(senderId, targetChatId);
        ChatMessageDTO messageDTO = chatMessageMapper.toMessageDTO(saved, senderInfo);
        deliverSentMessage(targetRoom, senderId, messageDTO);
        return messageDTO;
    }

    @Transactional
    public MessageWithAttachmentsDTO sendMixedMessage(Long senderId, String chatId,
                                                      String content, List<String> attachmentIds,
                                                      MessageType type, String replyToMessageId) {
        if (!isUserChatMember(chatId, senderId)) {
            throw new IllegalArgumentException("User is not a member of this chat");
        }

        ChatRoom room = chatRoomRepository.findById(chatId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));
        roomPermissionService.assertCanPostMessage(room, senderId);

        UserInfoDTO senderInfo = chatUserInfoService.getUserInfo(senderId);
        ChatMessage message = ChatMessage.builder()
                .chatId(chatId)
                .senderId(senderId)
                .senderName(senderInfo.getDisplayName())
                .content(content)
                .replyToMessageId(chatMessageMapper.normalizeReplyToMessageId(replyToMessageId))
                .messageType(type != null ? type : MessageType.MIXED)
                .timestamp(LocalDateTime.now())
                .isRead(false)
                .build();
        ChatMessage savedMessage = chatMessageRepository.save(message);

        List<Attachment> attachments = linkAttachments(attachmentIds, savedMessage);

        updateChatLastActivity(chatId, previewHelper.getPreviewText(content, attachments));
        publishMessageCreatedV1(savedMessage, previewHelper.getPreviewText(content, attachments));
        redisService.updatePresence(senderId, chatId);
        ChatMessageDTO messageDTO = chatMessageMapper.toMessageDTO(savedMessage, senderInfo);
        deliverSentMessage(room, senderId, messageDTO);
        return MessageWithAttachmentsDTO.fromEntity(savedMessage, attachments);
    }

    @Transactional
    public MessageWithAttachmentsDTO sendAttachmentsOnlyMessage(Long senderId, String chatId,
                                                                List<String> attachmentIds,
                                                                MessageType type,
                                                                String replyToMessageId) {
        if (!isUserChatMember(chatId, senderId)) {
            throw new IllegalArgumentException("User is not a member of this chat");
        }

        ChatRoom room = chatRoomRepository.findById(chatId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));
        roomPermissionService.assertCanPostMessage(room, senderId);

        UserInfoDTO senderInfo = chatUserInfoService.getUserInfo(senderId);
        ChatMessage message = ChatMessage.builder()
                .chatId(chatId)
                .senderId(senderId)
                .senderName(senderInfo.getDisplayName())
                .content(null)
                .replyToMessageId(chatMessageMapper.normalizeReplyToMessageId(replyToMessageId))
                .messageType(type)
                .timestamp(LocalDateTime.now())
                .isRead(false)
                .build();

        ChatMessage savedMessage = chatMessageRepository.save(message);
        List<Attachment> attachments = linkAttachments(attachmentIds, savedMessage);

        updateChatLastActivity(chatId, previewHelper.getPreviewText(null, attachments));
        publishMessageCreatedV1(savedMessage, previewHelper.getPreviewText(null, attachments));
        redisService.updatePresence(senderId, chatId);
        ChatMessageDTO messageDTO = chatMessageMapper.toMessageDTO(savedMessage, senderInfo);
        deliverSentMessage(room, senderId, messageDTO);
        return MessageWithAttachmentsDTO.fromEntity(savedMessage, attachments);
    }

    public Page<ChatMessageDTO> getMessageHistory(String chatId, Long currentUserId, Pageable pageable) {
        if (!isUserChatMember(chatId, currentUserId)) {
            throw new SecurityException("Access denied");
        }

        Page<ChatMessage> messagePage = chatMessageRepository
                .findByChatIdOrderByTimestampAsc(chatId, pageable);

        Set<Long> senderIds = messagePage.getContent().stream()
                .map(ChatMessage::getSenderId)
                .collect(Collectors.toSet());

        Map<Long, UserInfoDTO> userInfoMap = chatUserInfoService.getUserInfoBatch(senderIds);

        List<ChatMessageDTO> enrichedMessages = messagePage.getContent()
                .stream()
                .map(msg -> chatMessageMapper.toMessageDTO(msg, userInfoMap.get(msg.getSenderId()), currentUserId))
                .toList();

        return new PageImpl<>(enrichedMessages, pageable, messagePage.getTotalElements());
    }

    @Transactional
    public void markMessagesAsRead(String chatId, Long senderId) {
        if (!isUserChatMember(chatId, senderId)) {
            throw new SecurityException("Access denied");
        }

        redisService.updatePresence(senderId, chatId);
        webSocketService.notifyUserJoinedChat(chatId, senderId);

        List<ChatMessage> unreadMessages = chatMessageRepository
                .findUnreadMessagesNotFromUser(chatId, senderId);

        if (unreadMessages.isEmpty()) {
            return;
        }

        for (ChatMessage message : unreadMessages) {
            message.setRead(true);
            message.setReadAt(LocalDateTime.now());
        }

        chatMessageRepository.saveAll(unreadMessages);
        List<String> readMessageIds = unreadMessages.stream().map(ChatMessage::getId).toList();
        webSocketService.sendReadReceipt(chatId, senderId, readMessageIds);
    }

    @Transactional
    public void deleteMessage(String messageId, Long actorId) {
        ChatMessage toDelete = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));

        ChatRoom room = loadRoom(toDelete.getChatId());
        if (!roomPermissionService.canEditOrDeleteMessage(room, actorId, toDelete.getSenderId())) {
            throw new ForbiddenChatOperationException("You cannot delete this message");
        }

        String chatId = toDelete.getChatId();

        for (Attachment attachment : attachmentRepository.findByMessageId(messageId)) {
            try {
                fileStorageService.deleteFile(attachment.getId());
            } catch (RuntimeException ex) {
                log.warn("Failed to delete attachment {} for message {}", attachment.getId(), messageId, ex);
                attachmentRepository.delete(attachment);
            }
        }

        chatMessageRepository.delete(toDelete);
        refreshChatLastMessageAfterDelete(chatId);
        webSocketService.notifyMessageDeleted(messageId, chatId, actorId);
    }

    @Transactional
    public ChatMessageDTO editMessage(String messageId, Long actorId, String newContent) {
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));

        ChatRoom room = loadRoom(message.getChatId());
        MessageType messageType = message.getMessageType() != null ? message.getMessageType() : MessageType.TEXT;
        boolean canFullEdit = roomPermissionService.canEditOrDeleteMessage(room, actorId, message.getSenderId());
        if (!canFullEdit) {
            boolean canToggleTodoDone = messageType == MessageType.TODO
                    && isUserChatMember(message.getChatId(), actorId);
            if (!canToggleTodoDone) {
                throw new ForbiddenChatOperationException("You cannot edit this message");
            }
        }
        if (messageType == MessageType.POLL) {
            throw new IllegalArgumentException("Poll messages cannot be edited directly.");
        }
        boolean isRich = PersonalSpacePayloadValidator.isRichMessageType(messageType);
        if (!isRich
                && messageType != MessageType.TEXT
                && messageType != MessageType.MIXED
                && messageType != MessageType.ATTACHMENT) {
            throw new IllegalArgumentException("This message cannot be edited");
        }

        boolean hasAttachments = !attachmentRepository.findByMessageId(message.getId()).isEmpty();

        String normalizedContent = newContent == null ? "" : newContent.trim();
        MessageType resultingType;

        if (isRich) {
            personalSpacePayloadValidator.validate(messageType, normalizedContent);
            if (messageType == MessageType.TODO && !canFullEdit) {
                personalSpacePayloadValidator.assertTodoDoneOnlyChange(message.getContent(), normalizedContent);
            }
            message.setContent(normalizedContent);
            resultingType = messageType;
        } else if (normalizedContent.isBlank()) {
            if (!hasAttachments) {
                throw new IllegalArgumentException("Message content cannot be blank");
            }
            message.setContent(null);
            resultingType = MessageType.ATTACHMENT;
        } else {
            message.setContent(normalizedContent);
            resultingType = hasAttachments ? MessageType.MIXED : MessageType.TEXT;
        }
        message.setMessageType(resultingType);

        LocalDateTime editedAt = LocalDateTime.now();
        message.setEditedAt(editedAt);
        ChatMessage updatedMessage = chatMessageRepository.save(message);

        webSocketService.notifyMessageEdited(
                updatedMessage.getId(),
                updatedMessage.getChatId(),
                updatedMessage.getContent(),
                actorId,
                editedAt,
                updatedMessage.getMessageType()
        );

        return chatMessageMapper.toMessageDTO(updatedMessage,
                chatUserInfoService.getUserInfo(updatedMessage.getSenderId()), actorId);
    }

    @Transactional
    public ChatMessageDTO castPollVote(String messageId, Long userId, List<String> optionIds) {
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));
        MessageType messageType = message.getMessageType() != null ? message.getMessageType() : MessageType.TEXT;
        if (messageType != MessageType.POLL) {
            throw new IllegalArgumentException("This message is not a poll.");
        }
        if (!isUserChatMember(message.getChatId(), userId)) {
            throw new IllegalArgumentException("User is not a member of this chat.");
        }

        UserInfoDTO voterInfo = chatUserInfoService.getUserInfo(userId);
        String contentWithId = pollPayloadHelper.ensurePollId(message.getContent(), message.getId());
        if (!contentWithId.equals(message.getContent())) {
            message.setContent(contentWithId);
            chatMessageRepository.save(message);
        }
        String updatedContent = pollPayloadHelper.applyVote(
                contentWithId,
                userId,
                voterInfo.getDisplayName(),
                optionIds);
        personalSpacePayloadValidator.validate(MessageType.POLL, updatedContent);

        String pollId = pollPayloadHelper.extractPollId(updatedContent);
        if (pollId != null) {
            sharedPollService.propagatePollUpdate(pollId, updatedContent, userId);
        } else {
            message.setContent(updatedContent);
            ChatMessage saved = chatMessageRepository.save(message);
            webSocketService.notifyMessageEdited(
                    saved.getId(),
                    saved.getChatId(),
                    saved.getContent(),
                    userId,
                    null,
                    saved.getMessageType());
        }

        message.setContent(updatedContent);
        return chatMessageMapper.toMessageDTO(message, voterInfo, userId);
    }

    private void assertPollAllowedInRoom(ChatRoom room) {
        ChatType chatType = room.getType();
        if (chatType != ChatType.GROUP && chatType != ChatType.CHANNEL) {
            throw new IllegalArgumentException("Polls are only allowed in groups and channels.");
        }
    }

    public List<AttachmentDTO> listChatAttachmentsForRoom(String chatId) {
        List<Attachment> attachments = attachmentRepository.findByChatId(chatId).stream()
                .filter(a -> a.getMessageId() != null && !a.getMessageId().isBlank())
                .toList();
        if (attachments.isEmpty()) {
            return List.of();
        }

        Set<String> messageIds = attachments.stream()
                .map(Attachment::getMessageId)
                .collect(Collectors.toSet());
        Set<String> existingMessageIds = chatMessageRepository.findAllById(messageIds).stream()
                .map(ChatMessage::getId)
                .collect(Collectors.toSet());

        return attachments.stream()
                .filter(a -> existingMessageIds.contains(a.getMessageId()))
                .sorted(Comparator.comparing(
                        Attachment::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(AttachmentDTO::fromEntity)
                .toList();
    }

    public boolean isUserChatMember(String chatId, Long userId) {
        if (chatId == null || chatId.isBlank() || userId == null) {
            return false;
        }
        return chatRoomRepository.findById(chatId)
                .map(room -> {
                    if (!room.isMember(userId) || room.isBanned(userId)) {
                        return false;
                    }
                    if (room.getType() == ChatType.PRIVATE) {
                        return !userBanGuardService.isPrivateChatBlocked(room, userId);
                    }
                    return true;
                })
                .orElse(false);
    }

    private List<Attachment> linkAttachments(List<String> attachmentIds, ChatMessage savedMessage) {
        List<Attachment> attachments = new ArrayList<>();
        if (attachmentIds != null && !attachmentIds.isEmpty()) {
            for (String attachmentId : attachmentIds) {
                Attachment attachment = attachmentRepository.findById(attachmentId)
                        .orElseThrow(() -> new RuntimeException("Attachment not found: " + attachmentId));
                attachment.setMessageId(savedMessage.getId());
                attachment = attachmentRepository.save(attachment);
                attachments.add(attachment);
            }
        }
        return attachments;
    }

    private void validateForwardAccess(Long senderId, String targetChatId, ChatMessage source) {
        if (!isUserChatMember(source.getChatId(), senderId)) {
            throw new IllegalArgumentException("You cannot forward this message.");
        }
        if (!isUserChatMember(targetChatId, senderId)) {
            throw new IllegalArgumentException("User is not a member of this chat.");
        }
    }

    private void updateChatLastActivity(String chatId, String content) {
        chatRoomRepository.findById(chatId).ifPresent(chatRoom -> {
            chatRoom.setLastActivity(LocalDateTime.now());
            chatRoom.setLastMessage(content);
            chatRoomRepository.save(chatRoom);
        });
    }

    private void deliverSentMessage(ChatRoom room, Long senderId, ChatMessageDTO messageDTO) {
        if (room == null || room.getId() == null || messageDTO == null) {
            if (messageDTO != null && messageDTO.getChatId() != null) {
                webSocketService.sendMessageToChat(messageDTO.getChatId(), messageDTO);
            }
            return;
        }
        roomEnrichmentService.notifyRoomMembersChatUpdated(room);
        webSocketService.sendMessageToChat(room.getId(), messageDTO);
        webSocketService.notifyUserJoinedChat(room.getId(), senderId);
        privateChatContactRequestService.maybeCreateContactRequestForPrivateMessage(room, senderId);
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

    private void refreshChatLastMessageAfterDelete(String chatId) {
        chatRoomRepository.findById(chatId).ifPresent(chatRoom -> {
            Optional<ChatMessage> latest = chatMessageRepository.findTopByChatIdOrderByTimestampDesc(chatId);
            if (latest.isPresent()) {
                ChatMessage msg = latest.get();
                List<Attachment> attachments = attachmentRepository.findByMessageId(msg.getId());
                String preview = previewHelper.getPreviewText(
                        msg.getContent(), attachments, msg.getMessageType());
                chatRoom.setLastMessage(preview);
                if (msg.getTimestamp() != null) {
                    chatRoom.setLastActivity(msg.getTimestamp());
                }
            } else {
                chatRoom.setLastMessage("");
                if (chatRoom.getCreatedAt() != null) {
                    chatRoom.setLastActivity(chatRoom.getCreatedAt());
                }
            }
            chatRoomRepository.save(chatRoom);
            roomEnrichmentService.notifyRoomMembersChatUpdated(chatRoom);
        });
    }

    private ChatRoom loadRoom(String roomId) {
        return chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));
    }

    private void publishMessageCreatedV1(ChatMessage savedMessage, String previewText) {
        ChatRoom room = chatRoomRepository.findById(savedMessage.getChatId())
                .orElseThrow(() -> new IllegalStateException("Chat room not found for message " + savedMessage.getId()));

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
