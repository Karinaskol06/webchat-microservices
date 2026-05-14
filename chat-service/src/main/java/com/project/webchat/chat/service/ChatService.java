package com.project.webchat.chat.service;

import com.project.webchat.chat.dto.*;
import com.project.webchat.chat.entity.*;
import com.project.webchat.chat.exception.ForbiddenChatOperationException;
import com.project.webchat.chat.feign.UserServiceClient;
import com.project.webchat.chat.repository.AttachmentRepository;
import com.project.webchat.chat.repository.BootstrapMessageRecordRepository;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.shared.dto.ContactRequestCreateDTO;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.shared.dto.UserInfoDTO;
import com.project.webchat.shared.events.v1.MessageCreatedEventV1;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@AllArgsConstructor
@Slf4j
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final AttachmentRepository attachmentRepository;
    private final BootstrapMessageRecordRepository bootstrapMessageRecordRepository;
    private final RedisService redisService;
    private final WebSocketService webSocketService;
    private final UserServiceClient userServiceClient;
    private final MessageEventPublisher messageEventPublisher;
    private final FileStorageService fileStorageService;

    @Transactional
    public ChatRoomDTO createChat(Long userId1, Long userId2) {
        PrivateChatLookup lookup = findOrCreatePrivateChat(userId1, userId2);
        ChatRoom chatRoom = lookup.chatRoom();
        //if already existed - return it (idempotency)
        if (!lookup.createdNew()) {
            int unreadCount = getUnreadCount(chatRoom.getId(), userId1);
            ChatRoomDTO dto = enrichChatWithUserData(chatRoom, userId1, unreadCount);
            webSocketService.notifyChatCreated(userId2, dto);
            webSocketService.notifyChatCreated(userId1, dto);
            return dto;
        }
        //newly created chat
        ChatRoomDTO dto = enrichChatWithUserData(chatRoom, userId1, 0);

        //notify both users
        webSocketService.notifyChatCreated(userId1, dto);
        webSocketService.notifyChatCreated(userId2, dto);

        return dto;
    }

    // Handles the first message sent to a user with whom you don't yet have a chat
    //handles chat, first message and a friend request creation
    @Transactional
    public BootstrapMessageResponse bootstrapFirstMessage(Long senderId, BootstrapMessageRequest request) {
        if (request.getRecipientUserId() == null || senderId.equals(request.getRecipientUserId())) {
            throw new IllegalArgumentException("Recipient must be a different user");
        }
        if (request.getClientRequestKey() == null || request.getClientRequestKey().isBlank()) {
            throw new IllegalArgumentException("Client request key is required");
        }

        String normalizedContent = request.getContent() == null ? "" : request.getContent().trim();
        if (normalizedContent.isBlank()) {
            throw new IllegalArgumentException("Message content cannot be blank");
        }

        String normalizedRequestKey = request.getClientRequestKey().trim();

        //query for a record with the same senderId and clientRequestKey
        Optional<BootstrapMessageRecord> existingRecord = bootstrapMessageRecordRepository
                .findBySenderIdAndClientRequestKey(senderId, normalizedRequestKey);
        //if found - replay the already processed result
        if (existingRecord.isPresent()) {
            return replayBootstrap(existingRecord.get(), senderId);
        }

        //if not - create a new one and save
        BootstrapMessageRecord bootstrapRecord = BootstrapMessageRecord.builder()
                .senderId(senderId)
                .clientRequestKey(normalizedRequestKey)
                .createdAt(LocalDateTime.now())
                .build();
        try {
            bootstrapRecord = bootstrapMessageRecordRepository.save(bootstrapRecord);
        } catch (DuplicateKeyException e) {
            BootstrapMessageRecord persisted = bootstrapMessageRecordRepository
                    .findBySenderIdAndClientRequestKey(senderId, normalizedRequestKey)
                    .orElseThrow(() -> new IllegalStateException("Duplicate idempotency key but no record found", e));
            return replayBootstrap(persisted, senderId);
        }

        //find or create a private chat
        PrivateChatLookup lookup = findOrCreatePrivateChat(senderId, request.getRecipientUserId());
        ChatRoom chatRoom = lookup.chatRoom();
        boolean chatJustCreated = lookup.createdNew();

        //send an actual message
        SendMessageRequest sendMessageRequest = SendMessageRequest.builder()
                .chatId(chatRoom.getId())
                .content(normalizedContent)
                .type(MessageType.TEXT)
                .build();
        ChatMessageDTO messageDTO = sendMessage(senderId, sendMessageRequest);

        //update the bootstrap record (for future replays to know
        // which chat and message belongs to this idempotency key)
        bootstrapRecord.setChatId(chatRoom.getId());
        bootstrapRecord.setMessageId(messageDTO.getId());
        bootstrapMessageRecordRepository.save(bootstrapRecord);

        if (chatJustCreated) {
            ChatRoom freshRoom = chatRoomRepository.findById(chatRoom.getId()).orElse(chatRoom);
            Long recipientId = request.getRecipientUserId();
            int unreadForSender = getUnreadCount(freshRoom.getId(), senderId);
            int unreadForRecipient = getUnreadCount(freshRoom.getId(), recipientId);
            webSocketService.notifyChatCreated(senderId,
                    enrichChatWithUserData(freshRoom, senderId, unreadForSender));
            webSocketService.notifyChatCreated(recipientId,
                    enrichChatWithUserData(freshRoom, recipientId, unreadForRecipient));
        }

        //create a pending friend request from sender to recipient
        userServiceClient.createContactRequestIfEligible(ContactRequestCreateDTO.builder()
                .fromUserId(senderId)
                .toUserId(request.getRecipientUserId())
                .build());

        return BootstrapMessageResponse.builder()
                .chatId(chatRoom.getId())
                .message(messageDTO)
                .idempotentReplay(false)
                .build();
    }

    private PrivateChatLookup findOrCreatePrivateChat(Long userId1, Long userId2) {
        Optional<ChatRoom> existsAlready = chatRoomRepository
                .findPrivateChatBetweenUsers(ChatType.PRIVATE, List.of(userId1, userId2));
        if (existsAlready.isPresent()) {
            return new PrivateChatLookup(existsAlready.get(), false);
        }

        ChatRoom entity = ChatRoom.builder()
                .type(ChatType.PRIVATE)
                .memberIds(Set.of(userId1, userId2))
                .lastActivity(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .lastMessage("Chat was created!")
                .build();
        return new PrivateChatLookup(chatRoomRepository.save(entity), true);
    }

    private BootstrapMessageResponse replayBootstrap(BootstrapMessageRecord record, Long senderId) {
        if (record.getMessageId() == null || record.getChatId() == null) {
            throw new IllegalStateException("Bootstrap request is already in progress. Retry in a moment.");
        }
        ChatMessage existingMessage = chatMessageRepository.findById(record.getMessageId())
                .orElseThrow(() -> new IllegalStateException("Bootstrap record exists but message is missing"));
        UserInfoDTO senderInfo = getUserInfo(senderId);
        return BootstrapMessageResponse.builder()
                .chatId(record.getChatId())
                .message(toMessageDTO(existingMessage, senderInfo))
                .idempotentReplay(true)
                .build();
    }

    private record PrivateChatLookup(ChatRoom chatRoom, boolean createdNew) {}

    @Transactional
    public ChatMessageDTO sendMessage(Long senderId, SendMessageRequest sendMessageRequest) {
        //check is the user a participant in this chat
        boolean isParticipant = chatRoomRepository
                .existsByIdAndMemberIdsContains(sendMessageRequest.getChatId(), senderId);
        if (!isParticipant) {
            throw new IllegalArgumentException("User is not a member of this chat.");
        }

        ChatRoom room = chatRoomRepository.findById(sendMessageRequest.getChatId())
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));
        assertCanPostMessage(room, senderId);

        UserInfoDTO senderInfo = getUserInfo(senderId);

        //create and save a message
        ChatMessage chatMessage = ChatMessage.builder()
                .chatId(sendMessageRequest.getChatId())
                .messageType(sendMessageRequest.getType() != null ? sendMessageRequest.getType() : MessageType.TEXT)
                .content(sendMessageRequest.getContent())
                .replyToMessageId(normalizeReplyToMessageId(sendMessageRequest.getReplyToMessageId()))
                .senderId(senderId)
                .senderName(senderInfo.getDisplayName())
                .timestamp(LocalDateTime.now())
                .isRead(false)
                .build();
        ChatMessage saved = chatMessageRepository.save(chatMessage);
        publishMessageCreatedV1(saved, getPreviewText(sendMessageRequest.getContent(), List.of()));

        //update last activity
        updateChatLastActivity(sendMessageRequest.getChatId(), sendMessageRequest.getContent());
        chatRoomRepository.findById(sendMessageRequest.getChatId()).ifPresent(this::notifyRoomMembersChatUpdated);

        //mark user online or refresh online status
        redisService.updatePresence(senderId, sendMessageRequest.getChatId());

        //dto with full sender info (enriched)
        ChatMessageDTO messageDTO = toMessageDTO(saved, senderInfo);

        //send through websocket
        webSocketService.sendMessageToChat(sendMessageRequest.getChatId(), messageDTO);
        webSocketService.notifyUserJoinedChat(chatMessage.getChatId(), senderId);

        return messageDTO;
    }

    /**
     * Forwards a message into target chat with content and attachments copied server-side
     * (client cannot alter the payload). Files are duplicated on disk for the new message.
     */
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
        assertCanPostMessage(targetRoom, senderId);

        List<Attachment> sourceAttachments = collectAttachmentsForMessage(source);
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

        UserInfoDTO senderInfo = getUserInfo(senderId);
        ForwardOrigin forwardOrigin = buildForwardOriginFromSource(source);
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
        updateChatLastActivity(targetChatId, getPreviewText(saved.getContent(), newAttachments));
        chatRoomRepository.findById(targetChatId).ifPresent(this::notifyRoomMembersChatUpdated);
        publishMessageCreatedV1(saved, getPreviewText(saved.getContent(), newAttachments));

        redisService.updatePresence(senderId, targetChatId);
        ChatMessageDTO messageDTO = toMessageDTO(saved, senderInfo);
        webSocketService.sendMessageToChat(targetChatId, messageDTO);
        webSocketService.notifyUserJoinedChat(targetChatId, senderId);
        return messageDTO;
    }

    // Sending message with both text and attachments (mixed)
    @Transactional
    public MessageWithAttachmentsDTO sendMixedMessage(Long senderId, String chatId,
                                                      String content, List<String> attachmentIds,
                                                      MessageType type, String replyToMessageId) {
        if (!isUserChatMember(chatId, senderId)) {
            throw new IllegalArgumentException("User is not a member of this chat");
        }

        ChatRoom room = chatRoomRepository.findById(chatId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));
        assertCanPostMessage(room, senderId);

        UserInfoDTO senderInfo = getUserInfo(senderId);
        ChatMessage message = ChatMessage.builder()
                .chatId(chatId)
                .senderId(senderId)
                .senderName(senderInfo.getDisplayName())
                .content(content)
                .replyToMessageId(normalizeReplyToMessageId(replyToMessageId))
                .messageType(type != null ? type : MessageType.MIXED)
                .timestamp(LocalDateTime.now())
                .isRead(false)
                .build();
        ChatMessage savedMessage = chatMessageRepository.save(message);

        // Connecting attachments to the message
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

        updateChatLastActivity(chatId, getPreviewText(content, attachments));
        chatRoomRepository.findById(chatId).ifPresent(this::notifyRoomMembersChatUpdated);
        publishMessageCreatedV1(savedMessage, getPreviewText(content, attachments));

        redisService.updatePresence(senderId, chatId);
        ChatMessageDTO messageDTO = toMessageDTO(savedMessage, senderInfo);
        webSocketService.sendMessageToChat(chatId, messageDTO);
        webSocketService.notifyUserJoinedChat(chatId, senderId);

        return MessageWithAttachmentsDTO.fromEntity(savedMessage, attachments);
    }

    // Sending only attachments
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
        assertCanPostMessage(room, senderId);

        UserInfoDTO senderInfo = getUserInfo(senderId);
        // Creating a message without text
        ChatMessage message = ChatMessage.builder()
                .chatId(chatId)
                .senderId(senderId)
                .senderName(senderInfo.getDisplayName())
                .content(null)
                .replyToMessageId(normalizeReplyToMessageId(replyToMessageId))
                .messageType(type)
                .timestamp(LocalDateTime.now())
                .isRead(false)
                .build();

        ChatMessage savedMessage = chatMessageRepository.save(message);
        List<Attachment> attachments = new ArrayList<>();

        for (String attachmentId : attachmentIds) {
            Attachment attachment = attachmentRepository.findById(attachmentId)
                    .orElseThrow(() -> new RuntimeException("Attachment not found: " + attachmentId));

            attachment.setMessageId(savedMessage.getId());
            attachment = attachmentRepository.save(attachment);
            attachments.add(attachment);
        }

        updateChatLastActivity(chatId, getPreviewText(null, attachments));
        chatRoomRepository.findById(chatId).ifPresent(this::notifyRoomMembersChatUpdated);
        publishMessageCreatedV1(savedMessage, getPreviewText(null, attachments));

        redisService.updatePresence(senderId, chatId);
        ChatMessageDTO messageDTO = toMessageDTO(savedMessage, senderInfo);
        webSocketService.sendMessageToChat(chatId, messageDTO);
        webSocketService.notifyUserJoinedChat(chatId, senderId);

        return MessageWithAttachmentsDTO.fromEntity(savedMessage, attachments);
    }

    //user chats sorted by the last activity
    public Page<ChatRoomDTO> getAllUserChatsSorted(Long userId, Pageable pageable) {

        Page<ChatRoom> chatPage = chatRoomRepository
                .findByMemberIdsContainsOrderByLastActivityDesc(userId, pageable);

        List<ChatRoomDTO> chatRooms = chatPage.getContent()
                .stream()
                .map(chat -> enrichChatWithUserData(chat, userId, getUnreadCount(chat.getId(), userId)))
                .toList();

        return new PageImpl<>(chatRooms, pageable, chatPage.getTotalElements());
    }

    public Page<ChatMessageDTO> getMessageHistory(String chatId, Long currentUserId, Pageable pageable) {
        if (!isUserChatMember(chatId, currentUserId)) {
            throw new SecurityException("Access denied");
        }

        Page<ChatMessage> messagePage = chatMessageRepository
                .findByChatIdOrderByTimestampAsc(chatId, pageable);

        //get all unique sender IDs from this page
        //used primarily for group chats
        Set<Long> senderIds = messagePage.getContent().stream()
                .map(ChatMessage::getSenderId)
                .collect(Collectors.toSet());

        //fetch all user info in one batch
        //optimization to avoid one request per sender
        Map<Long, UserInfoDTO> userInfoMap = getUserInfoBatch(senderIds);

        //enrich messages with user info
        List<ChatMessageDTO> enrichedMessages = messagePage.getContent()
                .stream()
                .map(msg -> toMessageDTO(msg, userInfoMap.get(msg.getSenderId())))
                .toList();

        return new PageImpl<>(enrichedMessages, pageable, messagePage.getTotalElements());
    }

    @Transactional
    public void markMessagesAsRead(String chatId, Long senderId) {
        // ensure the caller is a chat member (prevents marking random chats)
        if (!isUserChatMember(chatId, senderId)) {
            throw new SecurityException("Access denied");
        }

        // treat this call as proof the user is viewing the chat:
        // keep presence consistent even if /presence/enter-chat wasn't called (or failed).
        redisService.updatePresence(senderId, chatId);
        webSocketService.notifyUserJoinedChat(chatId, senderId);

        //find unread messages where sender id not equal user id
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
        if (!canEditOrDeleteMessage(room, actorId, toDelete.getSenderId())) {
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
        if (!canEditOrDeleteMessage(room, actorId, message.getSenderId())) {
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

        return toMessageDTO(updatedMessage, getUserInfo(updatedMessage.getSenderId()));
    }

    @Transactional
    public void leaveChat(String chatId, Long userId) {
        ChatRoom chat = chatRoomRepository.findById(chatId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));

        if (!chat.getMemberIds().contains(userId)) {
            throw new IllegalArgumentException("User is not a member of this chat");
        }

        Set<Long> otherMembers = new HashSet<>(chat.getMemberIds());
        otherMembers.remove(userId);
        chat.getMemberIds().remove(userId);
        if (chat.getAdminIds() != null) {
            chat.getAdminIds().remove(userId);
        }
        if (chat.getChannelPosterIds() != null) {
            chat.getChannelPosterIds().remove(userId);
        }

        if (chat.getMemberIds().isEmpty()) {
            chatRoomRepository.delete(chat);
            webSocketService.notifyChatDeleted(chatId, otherMembers);
        } else {
            chatRoomRepository.save(chat);
            webSocketService.notifyUserLeftChatForAll(chatId, userId, otherMembers);
            notifyRoomMembersChatUpdated(chat);
        }

        redisService.markUserOffline(userId);
        webSocketService.notifyUserLeftChat(chatId, userId);
    }

    @Transactional
    public ChatRoomDTO createGroupRoom(Long creatorId, CreateGroupChannelRequest request) {
        return createGroupOrChannelRoom(creatorId, request, ChatType.GROUP);
    }

    @Transactional
    public ChatRoomDTO createChannelRoom(Long creatorId, CreateGroupChannelRequest request) {
        return createGroupOrChannelRoom(creatorId, request, ChatType.CHANNEL);
    }

    public Page<DiscoverableRoomDTO> discoverPublicRooms(Long currentUserId, String q, Pageable pageable) {
        String regex = (q == null || q.trim().isEmpty()) ? ".*" : Pattern.quote(q.trim());
        Page<ChatRoom> page = chatRoomRepository.findPublicDiscoverableRooms(
                ChatType.GROUP,
                ChatType.CHANNEL,
                RoomVisibility.PUBLIC,
                regex,
                currentUserId,
                pageable);
        return page.map(DiscoverableRoomDTO::fromRoom);
    }

    /**
     * Group chats and channels the user is already in, optionally filtered by room name.
     */
    public Page<DiscoverableRoomDTO> searchMyGroupChannels(Long currentUserId, String q, Pageable pageable) {
        String regex = (q == null || q.trim().isEmpty()) ? ".*" : Pattern.quote(q.trim());
        return chatRoomRepository
                .findMemberGroupChannelsByName(currentUserId, ChatType.GROUP, ChatType.CHANNEL, regex, pageable)
                .map(room -> DiscoverableRoomDTO.fromRoom(room, true));
    }

    public ChatRoomDTO getRoomForMember(String roomId, Long userId) {
        ChatRoom room = loadRoom(roomId);
        if (!room.isMember(userId)) {
            throw new ForbiddenChatOperationException("You are not a member of this chat");
        }
        return enrichChatWithUserData(room, userId, getUnreadCount(room.getId(), userId));
    }

    @Transactional
    public ChatRoomDTO joinPublicRoom(String roomId, Long userId) {
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));
        if (room.getType() != ChatType.GROUP && room.getType() != ChatType.CHANNEL) {
            throw new IllegalArgumentException("This chat cannot be joined from discovery");
        }
        RoomVisibility vis = room.getVisibility() != null ? room.getVisibility() : RoomVisibility.PRIVATE;
        if (vis != RoomVisibility.PUBLIC) {
            throw new IllegalArgumentException("This room is not public");
        }
        if (room.isMember(userId)) {
            return enrichChatWithUserData(room, userId, getUnreadCount(room.getId(), userId));
        }
        room.addMember(userId);
        ChatRoom saved = chatRoomRepository.save(room);
        notifyRoomMembersChatUpdated(saved);
        return enrichChatWithUserData(saved, userId, getUnreadCount(saved.getId(), userId));
    }

    @Transactional
    public ChatRoomDTO joinByInvite(Long userId, String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException("Invite token is required");
        }
        String token = rawToken.trim();
        ChatRoom room = chatRoomRepository.findByInviteToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired invite"));
        if (room.getType() != ChatType.GROUP && room.getType() != ChatType.CHANNEL) {
            throw new IllegalArgumentException("Invalid invite");
        }
        RoomVisibility vis = room.getVisibility() != null ? room.getVisibility() : RoomVisibility.PRIVATE;
        if (vis != RoomVisibility.PRIVATE) {
            throw new IllegalArgumentException("This invite is not valid for this room");
        }
        if (room.isMember(userId)) {
            return enrichChatWithUserData(room, userId, getUnreadCount(room.getId(), userId));
        }
        room.addMember(userId);
        ChatRoom saved = chatRoomRepository.save(room);
        notifyRoomMembersChatUpdated(saved);
        return enrichChatWithUserData(saved, userId, getUnreadCount(saved.getId(), userId));
    }

    @Transactional
    public InvitePayloadDTO regenerateInvite(String roomId, Long userId) {
        ChatRoom room = loadRoom(roomId);
        if (!room.isMember(userId)) {
            throw new ForbiddenChatOperationException("You must be a member to regenerate this invite");
        }
        RoomVisibility vis = room.getVisibility() != null ? room.getVisibility() : RoomVisibility.PRIVATE;
        if (vis != RoomVisibility.PRIVATE) {
            throw new IllegalArgumentException("Invite links are only available for private rooms");
        }
        if (room.getType() == ChatType.GROUP) {
            if (!effectiveAdminIds(room).contains(userId)) {
                throw new ForbiddenChatOperationException("Only group admins can regenerate the invite link");
            }
        } else if (room.getType() == ChatType.CHANNEL) {
            if (!effectiveChannelModeratorIds(room).contains(userId)) {
                throw new ForbiddenChatOperationException("Only channel owners and moderators can regenerate the invite link");
            }
        } else {
            throw new IllegalArgumentException("This room does not support invite links");
        }
        String newToken = UUID.randomUUID().toString();
        room.setInviteToken(newToken);
        ChatRoom saved = chatRoomRepository.save(room);
        notifyRoomMembersChatUpdated(saved);
        return new InvitePayloadDTO(newToken);
    }

    public InvitePayloadDTO getInvitePayload(String roomId, Long userId) {
        ChatRoom room = loadRoom(roomId);
        if (!room.isMember(userId)) {
            throw new ForbiddenChatOperationException("You are not a member of this chat");
        }
        RoomVisibility vis = room.getVisibility() != null ? room.getVisibility() : RoomVisibility.PRIVATE;
        if (vis != RoomVisibility.PRIVATE) {
            throw new IllegalArgumentException("This room has no invite link");
        }
        if (room.getType() == ChatType.GROUP) {
            if (!effectiveAdminIds(room).contains(userId)) {
                throw new ForbiddenChatOperationException("Only group admins can view the invite link");
            }
        } else if (room.getType() == ChatType.CHANNEL) {
            if (!effectiveChannelModeratorIds(room).contains(userId)) {
                throw new ForbiddenChatOperationException("Only channel owners and moderators can view the invite link");
            }
        } else {
            throw new IllegalArgumentException("This room does not support invite links");
        }
        if (room.getInviteToken() == null || room.getInviteToken().isBlank()) {
            throw new IllegalArgumentException("This room has no invite link");
        }
        return new InvitePayloadDTO(room.getInviteToken());
    }

    @Transactional
    public ChatRoomDTO mutateGroupAdmins(String roomId, Long actorId, AdminMutationRequest request) {
        ChatRoom room = loadRoom(roomId);
        if (room.getType() != ChatType.GROUP && room.getType() != ChatType.CHANNEL) {
            throw new IllegalArgumentException("Admin actions apply only to group chats and channels");
        }
        if (!room.isMember(actorId)) {
            throw new ForbiddenChatOperationException("You are not a member of this chat");
        }
        Long target = request.getUserId();
        AdminAction action = request.getAction();

        if (room.getType() == ChatType.GROUP) {
            if (action != AdminAction.PROMOTE && action != AdminAction.DEMOTE) {
                throw new IllegalArgumentException("Unsupported admin action for groups");
            }
            if (!effectiveAdminIds(room).contains(actorId)) {
                throw new ForbiddenChatOperationException("Only admins can change admin roles");
            }
            if (!room.isMember(target)) {
                throw new IllegalArgumentException("That user is not a member of this group");
            }
            Set<Long> admins = new HashSet<>(effectiveAdminIds(room));
            if (action == AdminAction.PROMOTE) {
                admins.add(target);
            } else {
                if (!admins.contains(target)) {
                    throw new IllegalArgumentException("That user is not an admin");
                }
                Set<Long> after = new HashSet<>(admins);
                after.remove(target);
                if (after.isEmpty()) {
                    throw new IllegalArgumentException("Cannot demote the last admin. Promote another member first.");
                }
                admins = after;
            }
            room.setAdminIds(admins);
        } else {
            if (!effectiveChannelModeratorIds(room).contains(actorId)) {
                throw new ForbiddenChatOperationException("Only channel owners and moderators can manage roles");
            }
            if (!room.isMember(target)) {
                throw new IllegalArgumentException("That user is not a member of this channel");
            }
            if (room.getCreatedBy() != null && room.getCreatedBy().equals(target)
                    && (action == AdminAction.DEMOTE || action == AdminAction.REVOKE_POST)) {
                throw new IllegalArgumentException("Cannot change the channel owner's moderator role or posting rights");
            }
            switch (action) {
                case PROMOTE -> {
                    if (room.getCreatedBy() != null && room.getCreatedBy().equals(target)) {
                        throw new IllegalArgumentException("The channel owner is already a moderator");
                    }
                    if (room.getAdminIds() == null) {
                        room.setAdminIds(new HashSet<>());
                    }
                    room.getAdminIds().add(target);
                    if (room.getChannelPosterIds() != null) {
                        room.getChannelPosterIds().remove(target);
                    }
                }
                case DEMOTE -> {
                    if (room.getAdminIds() == null || !room.getAdminIds().contains(target)) {
                        throw new IllegalArgumentException("That user is not a channel moderator");
                    }
                    room.getAdminIds().remove(target);
                }
                case GRANT_POST -> {
                    if (room.getCreatedBy() != null && room.getCreatedBy().equals(target)) {
                        throw new IllegalArgumentException("The channel owner can already post");
                    }
                    if (room.getAdminIds() != null && room.getAdminIds().contains(target)) {
                        throw new IllegalArgumentException("Channel moderators can already post");
                    }
                    if (room.getChannelPosterIds() == null) {
                        room.setChannelPosterIds(new HashSet<>());
                    }
                    room.getChannelPosterIds().add(target);
                }
                case REVOKE_POST -> {
                    if (room.getChannelPosterIds() == null || !room.getChannelPosterIds().contains(target)) {
                        throw new IllegalArgumentException("That user does not have explicit posting permission");
                    }
                    room.getChannelPosterIds().remove(target);
                }
                default -> throw new IllegalArgumentException("Unsupported admin action");
            }
        }
        ChatRoom saved = chatRoomRepository.save(room);
        notifyRoomMembersChatUpdated(saved);
        return enrichChatWithUserData(saved, actorId, getUnreadCount(saved.getId(), actorId));
    }

    @Transactional
    public ChatRoomDTO addRoomMember(String roomId, Long actorId, Long newMemberId) {
        if (newMemberId == null) {
            throw new IllegalArgumentException("User id is required");
        }
        ChatRoom room = loadRoom(roomId);
        if (room.getType() != ChatType.GROUP && room.getType() != ChatType.CHANNEL) {
            throw new IllegalArgumentException("Members can only be added to groups or channels");
        }
        if (!room.isMember(actorId)) {
            throw new ForbiddenChatOperationException("You are not a member of this chat");
        }
        boolean canInvite = room.getType() == ChatType.GROUP
                ? effectiveAdminIds(room).contains(actorId)
                : effectiveChannelModeratorIds(room).contains(actorId);
        if (!canInvite) {
            throw new ForbiddenChatOperationException("You cannot add members to this room");
        }
        if (room.isMember(newMemberId)) {
            return enrichChatWithUserData(room, actorId, getUnreadCount(room.getId(), actorId));
        }
        room.addMember(newMemberId);
        ChatRoom saved = chatRoomRepository.save(room);
        notifyRoomMembersChatUpdated(saved);
        webSocketService.notifyChatCreated(newMemberId,
                enrichChatWithUserData(saved, newMemberId, getUnreadCount(saved.getId(), newMemberId)));
        return enrichChatWithUserData(saved, actorId, getUnreadCount(saved.getId(), actorId));
    }

    public boolean isUserChatMember(String chatId, Long userId) {
        return chatRoomRepository.existsByIdAndMemberIdsContains(chatId, userId);
    }

    public int getUnreadCount(String chatId, Long currentUserId) {
        List<ChatMessage> unreadMessagesList = chatMessageRepository
                .findUnreadMessagesNotFromUser(chatId, currentUserId);
        return unreadMessagesList.size();
    }


    /* helper methods for user data */
    private UserInfoDTO getUserInfo(Long userId) {
        //check reds cache
        UserInfoDTO cached = redisService.getCachedUserInfo(userId);
        if (cached != null) {
            cached.setOnline(redisService.isUserOnline(userId));
            return cached;
        }

        //if not in cache, fetch from user-service
        try {
            ResponseEntity<UserDTO> response = userServiceClient.getUserById(userId);
            UserDTO userData = response.getBody();

            if (userData != null) {
                UserInfoDTO userInfo = UserInfoDTO.builder()
                        .id(userData.getId())
                        .username(userData.getUsername())
                        .firstName(userData.getFirstName())
                        .lastName(userData.getLastName())
                        .profilePicture(userData.getProfilePicture())
                        .online(redisService.isUserOnline(userId))
                        .build();

                //cache for next time
                redisService.cacheUserInfo(userInfo);
                return userInfo;
            }
        } catch (Exception e) {
            log.error("Failed to fetch user {}: {}", userId, e.getMessage());
        }

        //fallback if user-service is down
        return UserInfoDTO.builder()
                .id(userId)
                .username("User " + userId)
                .online(redisService.isUserOnline(userId))
                .build();
    }

    //user info for many users (group chat)
    private Map<Long, UserInfoDTO> getUserInfoBatch(Set<Long> userIds) {
        return userIds.stream()
                .collect(Collectors.toMap(
                        id -> id,
                        this::getUserInfo,
                        (existing, replacement) -> existing
                ));
    }

    //add user(s) data to chat
    private ChatRoomDTO enrichChatWithUserData(ChatRoom chat, Long currentUserId, int unreadCount) {
        RoomVisibility visibility = chat.getVisibility() != null ? chat.getVisibility() : RoomVisibility.PRIVATE;

        ChatRoomDTO.ChatRoomDTOBuilder builder = ChatRoomDTO.builder()
                .id(chat.getId())
                .type(chat.getType().toString())
                .visibility(visibility.name())
                .createdAt(chat.getCreatedAt())
                .lastActivity(chat.getLastActivity())
                .lastMessage(chat.getLastMessage())
                .unreadCount(unreadCount)
                .createdBy(chat.getCreatedBy())
                .memberCount(chat.getMemberIds() != null ? chat.getMemberIds().size() : 0)
                .currentUserAdmin(chat.getType() == ChatType.GROUP && effectiveAdminIds(chat).contains(currentUserId));

        boolean channelCreator = chat.getType() == ChatType.CHANNEL
                && chat.getCreatedBy() != null
                && chat.getCreatedBy().equals(currentUserId);
        boolean channelPromotedAdmin = chat.getType() == ChatType.CHANNEL
                && chat.getAdminIds() != null
                && chat.getAdminIds().contains(currentUserId);
        boolean channelPoster = chat.getType() == ChatType.CHANNEL
                && channelPosterIdsSet(chat).contains(currentUserId);
        builder.currentUserChannelCreator(channelCreator)
                .currentUserChannelAdmin(channelPromotedAdmin)
                .currentUserChannelPoster(channelPoster);

        //for private chats - find the other user
        if (chat.getType() == ChatType.PRIVATE) {
            Long otherUserId = chat.getMemberIds().stream()
                    .filter(id -> !id.equals(currentUserId))
                    .findFirst()
                    .orElse(null);
            if (otherUserId != null) {
                UserInfoDTO otherUser = getUserInfo(otherUserId);
                builder.otherUser(otherUser);
            }
        }

        //for group and channel chats - get all members
        if (chat.getType() == ChatType.GROUP || chat.getType() == ChatType.CHANNEL) {
            List<UserInfoDTO> members = chat.getMemberIds().stream()
                    .map(this::getUserInfo)
                    .toList();
            builder.members(members);
            builder.groupName(chat.getGroupName());
            builder.groupPhoto(chat.getGroupPhoto());
            builder.description(chat.getDescription());
            if (chat.getType() == ChatType.GROUP) {
                builder.adminUserIds(new ArrayList<>(effectiveAdminIds(chat)));
            } else if (chat.getType() == ChatType.CHANNEL) {
                builder.adminUserIds(chat.getAdminIds() == null
                        ? new ArrayList<>()
                        : new ArrayList<>(chat.getAdminIds()));
                builder.channelPosterUserIds(new ArrayList<>(channelPosterIdsSet(chat)));
            }
        }

        return builder.build();
    }

    /* helper methods */
    private void updateChatLastActivity(String chatId, String content) {
        chatRoomRepository.findById(chatId).ifPresent(chatRoom -> {
            chatRoom.setLastActivity(LocalDateTime.now());
            chatRoom.setLastMessage(content);
            chatRoomRepository.save(chatRoom);
        });
    }

    private ChatMessageDTO toMessageDTO(ChatMessage message, UserInfoDTO senderInfo) {
        ChatMessageDTO dto = ChatMessageDTO.toDTO(message, senderInfo);

        Map<String, AttachmentDTO> attachmentMap = new LinkedHashMap<>();

        // Legacy/source-1: attachment IDs stored on message itself
        if (message.getAttachmentIds() != null && !message.getAttachmentIds().isEmpty()) {
            attachmentRepository.findAllById(message.getAttachmentIds())
                    .stream()
                    .map(AttachmentDTO::fromEntity)
                    .forEach(att -> attachmentMap.put(att.getId(), att));
        }

        // Current/source-2: attachments linked by messageId in attachment records
        attachmentRepository.findByMessageId(message.getId())
                .stream()
                .map(AttachmentDTO::fromEntity)
                .forEach(att -> attachmentMap.put(att.getId(), att));

        dto.setAttachments(new ArrayList<>(attachmentMap.values()));
        dto.setRepliedMessage(buildReplyPreview(message));
        enrichForwardedFrom(message, dto);
        return dto;
    }

    private record ForwardOrigin(Long userId, String username) {}

    private void validateForwardAccess(Long senderId, String targetChatId, ChatMessage source) {
        if (!isUserChatMember(source.getChatId(), senderId)) {
            throw new IllegalArgumentException("You cannot forward this message.");
        }
        if (!isUserChatMember(targetChatId, senderId)) {
            throw new IllegalArgumentException("User is not a member of this chat.");
        }
    }

    private ForwardOrigin buildForwardOriginFromSource(ChatMessage source) {
        Long originAuthorId = source.getForwardedFromUserId() != null
                ? source.getForwardedFromUserId()
                : source.getSenderId();

        String username = source.getForwardedFromUsername();
        if (username == null || username.isBlank()) {
            UserInfoDTO originInfo = getUserInfo(originAuthorId);
            if (originInfo != null && originInfo.getUsername() != null && !originInfo.getUsername().isBlank()) {
                username = originInfo.getUsername();
            } else if (originInfo != null) {
                username = originInfo.getDisplayName();
            }
        }
        if (username == null || username.isBlank()) {
            username = source.getSenderName() != null ? source.getSenderName() : "Unknown";
        }

        return new ForwardOrigin(originAuthorId, username);
    }

    private List<Attachment> collectAttachmentsForMessage(ChatMessage source) {
        Map<String, Attachment> byId = new LinkedHashMap<>();
        if (source.getAttachmentIds() != null) {
            for (String id : source.getAttachmentIds()) {
                if (id == null || id.isBlank()) {
                    continue;
                }
                attachmentRepository.findById(id.trim()).ifPresent(att -> byId.put(att.getId(), att));
            }
        }
        attachmentRepository.findByMessageId(source.getId())
                .forEach(att -> byId.put(att.getId(), att));
        return new ArrayList<>(byId.values());
    }

    private void enrichForwardedFrom(ChatMessage message, ChatMessageDTO dto) {
        if (message.getForwardedFromUserId() == null) {
            return;
        }
        UserInfoDTO enriched = getUserInfo(message.getForwardedFromUserId());
        UserInfoDTO forwarded = UserInfoDTO.builder()
                .id(message.getForwardedFromUserId())
                .username(message.getForwardedFromUsername() != null && !message.getForwardedFromUsername().isBlank()
                        ? message.getForwardedFromUsername()
                        : (enriched != null ? enriched.getUsername() : null))
                .firstName(enriched != null ? enriched.getFirstName() : null)
                .lastName(enriched != null ? enriched.getLastName() : null)
                .profilePicture(enriched != null ? enriched.getProfilePicture() : null)
                .online(enriched != null && enriched.isOnline())
                .build();
        dto.setForwardedFrom(forwarded);
    }

    private String normalizeReplyToMessageId(String replyToMessageId) {
        if (replyToMessageId == null || replyToMessageId.isBlank()) {
            return null;
        }
        return replyToMessageId.trim();
    }

    private ReplyPreviewDTO buildReplyPreview(ChatMessage message) {
        String replyToMessageId = normalizeReplyToMessageId(message.getReplyToMessageId());
        if (replyToMessageId == null) {
            return null;
        }

        Optional<ChatMessage> parentOptional = chatMessageRepository.findById(replyToMessageId);
        if (parentOptional.isEmpty()) {
            return ReplyPreviewDTO.builder()
                    .messageId(replyToMessageId)
                    .deleted(true)
                    .build();
        }

        ChatMessage parent = parentOptional.get();
        UserInfoDTO senderInfo = getUserInfo(parent.getSenderId());
        return ReplyPreviewDTO.builder()
                .messageId(parent.getId())
                .senderId(parent.getSenderId())
                .senderDisplayName(senderInfo != null ? senderInfo.getDisplayName() : parent.getSenderName())
                .content(getPreviewText(parent.getContent(), attachmentRepository.findByMessageId(parent.getId())))
                .messageType(parent.getMessageType())
                .deleted(false)
                .build();
    }

    private String getPreviewText(String content, List<Attachment> attachments) {
        if (content != null && !content.isBlank()) {
            return content.length() > 50 ? content.substring(0, 47) + "..." : content;
        }
        if (attachments != null && !attachments.isEmpty()) {
            if (attachments.size() == 1) {
                Attachment att = attachments.getFirst();
                if (att.isImage()) {
                    return "Image";
                }
                return att.getFilename();
            }
            return attachments.size() + " files";
        }
        return "New message";
    }

    private ChatRoomDTO createGroupOrChannelRoom(Long creatorId, CreateGroupChannelRequest request, ChatType type) {
        if (type != ChatType.GROUP && type != ChatType.CHANNEL) {
            throw new IllegalArgumentException("Invalid room type");
        }
        String name = request.getName().trim();
        if (name.isEmpty()) {
            throw new IllegalArgumentException("Name is required");
        }
        Set<Long> members = new HashSet<>();
        if (request.getMemberIds() != null) {
            members.addAll(request.getMemberIds());
        }
        members.remove(null);
        members.add(creatorId);

        RoomVisibility visibility = request.getVisibility();
        String inviteToken = visibility == RoomVisibility.PRIVATE ? UUID.randomUUID().toString() : null;
        Set<Long> adminIds = type == ChatType.GROUP ? new HashSet<>(Set.of(creatorId)) : new HashSet<>();

        String groupPhoto = normalizeGroupPhoto(request.getGroupPhoto());
        String description = normalizeRoomDescription(request.getDescription());

        ChatRoom room = ChatRoom.builder()
                .type(type)
                .visibility(visibility)
                .memberIds(members)
                .groupName(name)
                .groupPhoto(groupPhoto)
                .description(description)
                .createdBy(creatorId)
                .adminIds(adminIds)
                .channelPosterIds(new HashSet<>())
                .inviteToken(inviteToken)
                .lastActivity(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .lastMessage("Chat was created!")
                .build();

        ChatRoom saved = chatRoomRepository.save(room);
        for (Long memberId : saved.getMemberIds()) {
            webSocketService.notifyChatCreated(memberId,
                    enrichChatWithUserData(saved, memberId, getUnreadCount(saved.getId(), memberId)));
        }
        return enrichChatWithUserData(saved, creatorId, getUnreadCount(saved.getId(), creatorId));
    }

    private void notifyRoomMembersChatUpdated(ChatRoom room) {
        if (room.getMemberIds() == null || room.getMemberIds().isEmpty()) {
            return;
        }
        for (Long memberId : new HashSet<>(room.getMemberIds())) {
            ChatRoomDTO dto = enrichChatWithUserData(room, memberId, getUnreadCount(room.getId(), memberId));
            webSocketService.notifyChatUpdated(room.getId(), dto, Set.of(memberId));
        }
    }

    private ChatRoom loadRoom(String roomId) {
        return chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));
    }

    private String normalizeGroupPhoto(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.startsWith("data:image/")) {
            return trimmed;
        }
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return trimmed;
        }
        throw new IllegalArgumentException("Room image must be an https URL or a pasted image (data URL).");
    }

    private String normalizeRoomDescription(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void assertCanPostMessage(ChatRoom room, Long senderId) {
        if (room.getType() != ChatType.CHANNEL) {
            return;
        }
        boolean canPost = room.getCreatedBy() != null && room.getCreatedBy().equals(senderId)
                || (room.getAdminIds() != null && room.getAdminIds().contains(senderId))
                || channelPosterIdsSet(room).contains(senderId);
        if (!canPost) {
            throw new ForbiddenChatOperationException("You do not have permission to post in this channel.");
        }
    }

    private Set<Long> effectiveChannelModeratorIds(ChatRoom room) {
        if (room.getType() != ChatType.CHANNEL) {
            return Set.of();
        }
        Set<Long> out = new HashSet<>();
        if (room.getCreatedBy() != null) {
            out.add(room.getCreatedBy());
        }
        if (room.getAdminIds() != null) {
            out.addAll(room.getAdminIds());
        }
        return out;
    }

    private Set<Long> channelPosterIdsSet(ChatRoom room) {
        if (room.getChannelPosterIds() == null) {
            return new HashSet<>();
        }
        return new HashSet<>(room.getChannelPosterIds());
    }

    private boolean canEditOrDeleteMessage(ChatRoom room, Long actorId, Long messageSenderId) {
        if (actorId.equals(messageSenderId)) {
            return true;
        }
        if (room.getType() == ChatType.GROUP) {
            return effectiveAdminIds(room).contains(actorId);
        }
        if (room.getType() == ChatType.CHANNEL) {
            return effectiveChannelModeratorIds(room).contains(actorId);
        }
        return false;
    }

    private Set<Long> effectiveAdminIds(ChatRoom room) {
        if (room.getType() != ChatType.GROUP) {
            return Set.of();
        }
        Set<Long> raw = room.getAdminIds();
        if (raw != null && !raw.isEmpty()) {
            return new HashSet<>(raw);
        }
        if (room.getCreatedBy() != null) {
            return new HashSet<>(Set.of(room.getCreatedBy()));
        }
        return new HashSet<>();
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

        UserInfoDTO senderDto = getUserInfo(savedMessage.getSenderId());
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