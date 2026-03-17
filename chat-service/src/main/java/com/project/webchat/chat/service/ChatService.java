package com.project.webchat.chat.service;

import com.project.webchat.chat.dto.ChatMessageDTO;
import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.dto.SendMessageRequest;
import com.project.webchat.chat.entity.ChatMessage;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.entity.MessageType;
import com.project.webchat.chat.feign.UserServiceClient;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.shared.dto.UserInfoDTO;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@AllArgsConstructor
@Slf4j
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final RedisService redisService;
    private final WebSocketService webSocketService;
    private final UserServiceClient userServiceClient;

    @Transactional
    public ChatRoomDTO createChat(Long userId1, Long userId2) {

        //check if it exists already
        Optional<ChatRoom> existsAlready = chatRoomRepository
                .findPrivateChatBetweenUsers(ChatType.PRIVATE, List.of(userId1, userId2));

        if (existsAlready.isPresent()) {
            ChatRoom chatRoom = existsAlready.get();
            int unreadCount = getUnreadCount(chatRoom.getId(), userId1);
            return enrichChatWithUserData(chatRoom, userId1, unreadCount);
        }

        ChatRoom entity = ChatRoom.builder()
                .type(ChatType.PRIVATE)
                .memberIds(Set.of(userId1, userId2))
                .lastActivity(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .lastMessage("Chat was created!")
                .build();

        //id is generated
        ChatRoom saved = chatRoomRepository.save(entity);

        createWelcomeMessage(saved.getId(), userId1);

        return enrichChatWithUserData(saved, userId1, 0);
    }

    @Transactional
    public ChatMessageDTO sendMessage(Long senderId, SendMessageRequest sendMessageRequest) {
        //check is the user a participant in this chat
        Boolean isParticipant = chatRoomRepository
                .existsByIdAndMemberIdsContains(sendMessageRequest.getChatId(), senderId);
        if (!isParticipant) {
            throw new IllegalArgumentException("User is not a member of this chat.");
        }

        UserInfoDTO senderInfo = getUserInfo(senderId);

        //create and save a message
        ChatMessage chatMessage = ChatMessage.builder()
                .chatId(sendMessageRequest.getChatId())
                .messageType(sendMessageRequest.getType())
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
        ChatMessageDTO messageDTO = ChatMessageDTO.toDTO(saved, senderInfo);

        //send through websocket
        webSocketService.sendMessageToChat(sendMessageRequest.getChatId(), messageDTO);
        webSocketService.notifyUserJoinedChat(chatMessage.getChatId(), senderId);

        return messageDTO;
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
                //mapping combines raw entity fields with user info
                .map(msg -> ChatMessageDTO.toDTO
                        (msg, userInfoMap.get(msg.getSenderId())))
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
        webSocketService.sendReadReceipt(chatId, senderId, lastId, readMessageIds);
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
        webSocketService.notifyMessageDeleted(messageId, chatId);
    }

    @Transactional
    public void leaveChat(String chatId, Long userId) {
        ChatRoom chat = chatRoomRepository.findById(chatId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));

        if (!chat.getMemberIds().contains(userId)) {
            throw new IllegalArgumentException("User is not a member of this chat");
        }

        chat.getMemberIds().remove(userId);

        //if there are no members - delete chat
        if (chat.getMemberIds().isEmpty()) {
            chatRoomRepository.delete(chat);
        } else {
            chatRoomRepository.save(chat);
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
}