package com.project.webchat.chat.service.message;

import com.project.webchat.chat.dto.AttachmentDTO;
import com.project.webchat.chat.dto.ChatMessageDTO;
import com.project.webchat.chat.dto.MessageWithAttachmentsDTO;
import com.project.webchat.chat.dto.SendMessageRequest;
import com.project.webchat.chat.entity.Attachment;
import com.project.webchat.chat.entity.ChatMessage;
import com.project.webchat.chat.entity.ChatRoom;
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
import com.project.webchat.chat.service.user.ChatUserInfoService;
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

    @Transactional
    public ChatMessageDTO sendMessage(Long senderId, SendMessageRequest sendMessageRequest) {
        boolean isParticipant = chatRoomRepository
                .existsByIdAndMemberIdsContains(sendMessageRequest.getChatId(), senderId);
        if (!isParticipant) {
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
        chatRoomRepository.findById(sendMessageRequest.getChatId()).ifPresent(roomEnrichmentService::notifyRoomMembersChatUpdated);

        redisService.updatePresence(senderId, sendMessageRequest.getChatId());

        ChatMessageDTO messageDTO = chatMessageMapper.toMessageDTO(saved, senderInfo);

        webSocketService.sendMessageToChat(sendMessageRequest.getChatId(), messageDTO);
        webSocketService.notifyUserJoinedChat(chatMessage.getChatId(), senderId);

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
        if (!hasText && !hasAttachments) {
            throw new IllegalArgumentException("Nothing to forward.");
        }

        MessageType type;
        if (hasText && hasAttachments) {
            type = MessageType.MIXED;
        } else if (hasText) {
            type = MessageType.TEXT;
        } else {
            type = source.getMessageType() != null && source.getMessageType() != MessageType.TEXT
                    ? source.getMessageType()
                    : MessageType.ATTACHMENT;
        }

        UserInfoDTO senderInfo = chatUserInfoService.getUserInfo(senderId);
        ChatMessageMapper.ForwardOrigin forwardOrigin = chatMessageMapper.buildForwardOriginFromSource(source);
        ChatMessage saved = chatMessageRepository.save(ChatMessage.builder()
                .chatId(targetChatId)
                .senderId(senderId)
                .senderName(senderInfo.getDisplayName())
                .content(hasText ? rawContent : null)
                .replyToMessageId(null)
                .messageType(type)
                .timestamp(LocalDateTime.now())
                .isRead(false)
                .forwardedFromUserId(forwardOrigin.userId())
                .forwardedFromUsername(forwardOrigin.username())
                .build());

        List<Attachment> newAttachments = new ArrayList<>();
        for (Attachment att : sourceAttachments) {
            Attachment clone = fileStorageService.cloneAttachmentForForward(att, saved.getId(),
                    targetChatId, senderId);
            newAttachments.add(clone);
        }
        updateChatLastActivity(targetChatId, previewHelper.getPreviewText(saved.getContent(), newAttachments));
        chatRoomRepository.findById(targetChatId).ifPresent(roomEnrichmentService::notifyRoomMembersChatUpdated);
        publishMessageCreatedV1(saved, previewHelper.getPreviewText(saved.getContent(), newAttachments));

        redisService.updatePresence(senderId, targetChatId);
        ChatMessageDTO messageDTO = chatMessageMapper.toMessageDTO(saved, senderInfo);
        webSocketService.sendMessageToChat(targetChatId, messageDTO);
        webSocketService.notifyUserJoinedChat(targetChatId, senderId);
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
        chatRoomRepository.findById(chatId).ifPresent(roomEnrichmentService::notifyRoomMembersChatUpdated);
        publishMessageCreatedV1(savedMessage, previewHelper.getPreviewText(content, attachments));

        redisService.updatePresence(senderId, chatId);
        ChatMessageDTO messageDTO = chatMessageMapper.toMessageDTO(savedMessage, senderInfo);
        webSocketService.sendMessageToChat(chatId, messageDTO);
        webSocketService.notifyUserJoinedChat(chatId, senderId);

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
        chatRoomRepository.findById(chatId).ifPresent(roomEnrichmentService::notifyRoomMembersChatUpdated);
        publishMessageCreatedV1(savedMessage, previewHelper.getPreviewText(null, attachments));

        redisService.updatePresence(senderId, chatId);
        ChatMessageDTO messageDTO = chatMessageMapper.toMessageDTO(savedMessage, senderInfo);
        webSocketService.sendMessageToChat(chatId, messageDTO);
        webSocketService.notifyUserJoinedChat(chatId, senderId);

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

        chatMessageRepository.delete(toDelete);
        webSocketService.notifyMessageDeleted(messageId, chatId, actorId);
    }

    @Transactional
    public ChatMessageDTO editMessage(String messageId, Long actorId, String newContent) {
        ChatMessage message = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));

        ChatRoom room = loadRoom(message.getChatId());
        if (!roomPermissionService.canEditOrDeleteMessage(room, actorId, message.getSenderId())) {
            throw new ForbiddenChatOperationException("You cannot edit this message");
        }

        MessageType messageType = message.getMessageType() != null ? message.getMessageType() : MessageType.TEXT;
        if (messageType != MessageType.TEXT && messageType != MessageType.MIXED && messageType != MessageType.ATTACHMENT) {
            throw new IllegalArgumentException("This message cannot be edited");
        }

        boolean hasAttachments = !attachmentRepository.findByMessageId(message.getId()).isEmpty();

        String normalizedContent = newContent == null ? "" : newContent.trim();
        MessageType resultingType;

        if (normalizedContent.isBlank()) {
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

    public List<AttachmentDTO> listChatAttachmentsForRoom(String chatId) {
        return attachmentRepository.findByChatId(chatId).stream()
                .filter(a -> a.getMessageId() != null && !a.getMessageId().isBlank())
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
        return chatRoomRepository.existsByIdAndMemberIdsContains(chatId, userId);
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

    private ChatRoom loadRoom(String roomId) {
        return chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));
    }

    private void publishMessageCreatedV1(ChatMessage savedMessage, String previewText) {
        ChatRoom room = chatRoomRepository.findById(savedMessage.getChatId())
                .orElseThrow(() -> new IllegalStateException("Chat room not found for message " + savedMessage.getId()));

        List<Long> recipientIds = room.getMemberIds().stream()
                .filter(memberId -> !memberId.equals(savedMessage.getSenderId()))
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
}
