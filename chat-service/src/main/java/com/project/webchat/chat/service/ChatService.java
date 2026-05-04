package com.project.webchat.chat.service;

import com.project.webchat.chat.dto.*;
import com.project.webchat.chat.entity.*;
import com.project.webchat.chat.feign.UserServiceClient;
import com.project.webchat.chat.repository.AttachmentRepository;
import com.project.webchat.chat.repository.BootstrapMessageRecordRepository;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.shared.dto.ContactRequestCreateDTO;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.shared.dto.UserInfoDTO;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
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

        UserInfoDTO senderInfo = getUserInfo(senderId);

        //create and save a message
        ChatMessage chatMessage = ChatMessage.builder()
                .chatId(sendMessageRequest.getChatId())
                .messageType(sendMessageRequest.getType() != null ? sendMessageRequest.getType() : MessageType.TEXT)
                .content(sendMessageRequest.getContent())
                .senderId(senderId)
                .senderName(senderInfo.getDisplayName())
                .timestamp(LocalDateTime.now())
                .isRead(false)
                .build();
        ChatMessage saved = chatMessageRepository.save(chatMessage);

        //update last activity
        updateChatLastActivity(sendMessageRequest.getChatId(), sendMessageRequest.getContent());

        //mark user online or refresh online status
        redisService.updatePresence(senderId, sendMessageRequest.getChatId());

        //dto with full sender info (enriched)
        ChatMessageDTO messageDTO = toMessageDTO(saved, senderInfo);

        //send through websocket
        webSocketService.sendMessageToChat(sendMessageRequest.getChatId(), messageDTO);
        webSocketService.notifyUserJoinedChat(chatMessage.getChatId(), senderId);

        return messageDTO;
    }

    // Sending message with both text and attachments (mixed)
    @Transactional
    public MessageWithAttachmentsDTO sendMixedMessage(Long senderId, String chatId,
                                                      String content, List<String> attachmentIds,
                                                      MessageType type) {
        if (!isUserChatMember(chatId, senderId)) {
            throw new IllegalArgumentException("User is not a member of this chat");
        }

        ChatMessage message = ChatMessage.builder()
                .chatId(chatId)
                .senderId(senderId)
                .content(content)
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

        // Sending via websocket with attachments
        webSocketService.sendMixedMessageToChat(chatId, savedMessage, attachments);

        return MessageWithAttachmentsDTO.fromEntity(savedMessage, attachments);
    }

    // Sending only attachments
    @Transactional
    public MessageWithAttachmentsDTO sendAttachmentsOnlyMessage(Long senderId, String chatId,
                                                                List<String> attachmentIds,
                                                                MessageType type) {

        if (!isUserChatMember(chatId, senderId)) {
            throw new IllegalArgumentException("User is not a member of this chat");
        }

        // Creating a message without text
        ChatMessage message = ChatMessage.builder()
                .chatId(chatId)
                .senderId(senderId)
                .content(null)
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

        webSocketService.sendMixedMessageToChat(chatId, savedMessage, attachments);

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

        String lastId = unreadMessages.getLast().getId();

        for (ChatMessage message : unreadMessages) {
            message.setRead(true);
            message.setReadAt(LocalDateTime.now());
        }

        chatMessageRepository.saveAll(unreadMessages);
        List<String> readMessageIds = unreadMessages.stream().map(ChatMessage::getId).toList();
        webSocketService.sendReadReceipt(chatId, senderId, readMessageIds);
    }

    @Transactional
    public void deleteMessage(String messageId, Long senderId) {
        ChatMessage toDelete = chatMessageRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));

        if (!senderId.equals(toDelete.getSenderId())) {
            throw new IllegalArgumentException("You can only delete your own messages");
        }

        //storing chat id for websocket
        String chatId = toDelete.getChatId();

        chatMessageRepository.delete(toDelete);
        webSocketService.notifyMessageDeleted(messageId, chatId, senderId);
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

        if (chat.getMemberIds().isEmpty()) {
            chatRoomRepository.delete(chat);
            webSocketService.notifyChatDeleted(chatId, otherMembers);
        } else {
            chatRoomRepository.save(chat);
            webSocketService.notifyUserLeftChatForAll(chatId, userId, otherMembers);
        }

        redisService.markUserOffline(userId);
        webSocketService.notifyUserLeftChat(chatId, userId);
    }

    public void updateLastActivity(String chatId, String lastMessage) {
        chatRoomRepository.findById(chatId).ifPresent(chatRoom -> {
            chatRoom.setLastMessage(lastMessage);
            chatRoom.setLastActivity(LocalDateTime.now());
            chatRoomRepository.save(chatRoom);
        });
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
        ChatRoomDTO.ChatRoomDTOBuilder builder = ChatRoomDTO.builder()
                .id(chat.getId())
                .type(chat.getType().toString())
                .createdAt(chat.getCreatedAt())
                .lastActivity(chat.getLastActivity())
                .lastMessage(chat.getLastMessage())
                .unreadCount(unreadCount);

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

        //for group chats - get all members
        if (chat.getType() == ChatType.GROUP) {
            List<UserInfoDTO> members = chat.getMemberIds().stream()
                    .map(this::getUserInfo)
                    .toList();
            builder.members(members);
            builder.groupName(chat.getGroupName());
            builder.groupPhoto(chat.getGroupPhoto());
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

    private void createWelcomeMessage(String chatId, Long chatCreatorId) {
        ChatMessage welcome = ChatMessage.builder()
                .chatId(chatId)
                .messageType(MessageType.TEXT)
                .content("Chat is created! You may start messaging.")
                .senderId(chatCreatorId)
                .isRead(false)
                .timestamp(LocalDateTime.now())
                .senderName("System")
                .build();

        chatMessageRepository.save(welcome);
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
        return dto;
    }

    private MessageType resolveMessageType(String messageType, List<String> attachmentIds) {
        if (messageType != null && !messageType.isBlank()) {
            return MessageType.valueOf(messageType);
        }
        if (attachmentIds != null && !attachmentIds.isEmpty()) {
            return MessageType.ATTACHMENT;
        }
        return MessageType.TEXT;
    }

    private String getPreviewText(String content, List<Attachment> attachments) {
        if (content != null && !content.isBlank()) {
            return content.length() > 50 ? content.substring(0, 47) + "..." : content;
        }
        if (attachments != null && !attachments.isEmpty()) {
            if (attachments.size() == 1) {
                Attachment att = attachments.get(0);
                if (att.isImage()) {
                    return "Image";
                }
                return att.getFilename();
            }
            return attachments.size() + " files";
        }
        return "New message";
    }
}