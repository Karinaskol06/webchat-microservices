package com.project.webchat.chat.service;

import com.project.webchat.chat.dto.ChatMessageDTO;
import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.dto.SendMessageRequest;
import com.project.webchat.chat.entity.ChatMessage;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.entity.MessageType;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.repository.ChatRoomRepository;
import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
@AllArgsConstructor
@Slf4j
public class ChatService {

    private final ChatMessageRepository chatMessageRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final RedisService redisService;
    private final WebSocketService webSocketService;

    @Transactional
    public ChatRoomDTO createChat(Long userId1, Long userId2) {

        List<Long> memberIds = List.of(userId1, userId2);

        Optional<ChatRoom> existsAlready = chatRoomRepository
                .findPrivateChatBetweenUsers(ChatType.PRIVATE, List.of(userId1, userId2));

        if (existsAlready.isPresent()) {
            ChatRoom chatRoom = existsAlready.get();
            int unreadCount = getUnreadCount(chatRoom.getId(), userId1);
            return ChatRoomDTO.toDTO(chatRoom, unreadCount);
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

        return ChatRoomDTO.toDTO(saved, 0);
    }

    //user chats sorted by the last activity
    public Page<ChatRoomDTO> getAllUserChatsSorted(Long userId, Pageable pageable) {

        Page<ChatRoom> chatPage = chatRoomRepository
                .findByMemberIdsContainsOrderByLastActivityDesc(userId, pageable);

        List<ChatRoomDTO> chatRooms = chatPage.getContent().stream()
                .map(chat -> toDTO(chat, userId))
                .toList();

        return new PageImpl<>(chatRooms, pageable, chatPage.getTotalElements());
    }

    @Transactional
    public ChatMessageDTO sendMessage(Long senderId, SendMessageRequest sendMessageRequest) {
        //check is the user a participant in this chat
        Boolean isParticipant = chatRoomRepository
                .existsByIdAndMemberIdsContains(sendMessageRequest.getChatId(), senderId);
        if (!isParticipant) {
            throw new IllegalArgumentException("User is not a member of this chat.");
        }

        //create and save a message
        ChatMessage chatMessage = ChatMessage.builder()
                .chatId(sendMessageRequest.getChatId())
                .messageType(MessageType.valueOf(sendMessageRequest.getMessageType()))
                .content(sendMessageRequest.getContent())
                .senderId(senderId)
                .senderName("User " + senderId) //then from UserService
                .timestamp(LocalDateTime.now())
                .isRead(false)
                .build();
        ChatMessage saved = chatMessageRepository.save(chatMessage);

        //update last activity
        updateChatLastActivity(sendMessageRequest.getChatId(), sendMessageRequest.getContent());

        //mark user online or refresh online status
        redisService.updatePresence(senderId, sendMessageRequest.getChatId());

        //send through websocket
        webSocketService.sendMessageToChat(sendMessageRequest.getChatId(), ChatMessageDTO.toDTO(saved));
        webSocketService.notifyUserJoinedChat(chatMessage.getChatId(), senderId);

        return ChatMessageDTO.toDTO(saved);
    }

    public Page<ChatMessageDTO> getMessageHistory(String chatId, Pageable pageable) {
        Page<ChatMessage> messagePage = chatMessageRepository
                .findByChatIdOrderByTimestampDesc(chatId, pageable);

        return messagePage.map(ChatMessageDTO::toDTO);
    }

    //pass sender id to mark as read only when the other person reads a message (not me)
    @Transactional
    public void markMessagesAsRead(String chatId, Long readerId) {
        log.info("=== MARKING MESSAGES AS READ ===");
        log.info("Chat ID: {}, Reader ID: {}", chatId, readerId);

        // Find unread messages where sender id not equal user id
        List<ChatMessage> unreadMessages = chatMessageRepository
                .findUnreadMessagesNotFromUser(chatId, readerId);

        log.info("Found {} unread messages from others", unreadMessages.size());

        if (unreadMessages.isEmpty()) {
            log.warn("NO UNREAD MESSAGES FOUND for chat {} and reader {}", chatId, readerId);

            // DEBUG: Let's see what messages DO exist
            Page<ChatMessage> allMessages = chatMessageRepository
                    .findByChatIdOrderByTimestampDesc(chatId, Pageable.unpaged());
            log.info("Total messages in chat: {}", allMessages.getTotalElements());

            for (ChatMessage msg : allMessages.getContent()) {
                log.info("Message ID: {}, Sender: {}, Read: {}, Is From Reader? {}",
                        msg.getId(),
                        msg.getSenderId(),
                        msg.isRead(),
                        msg.getSenderId().equals(readerId) ? "YES (will be filtered out)" : "NO");
            }
            return;
        }

        String lastId = unreadMessages.getLast().getId();
        log.info("Marking {} messages as read. Last message ID: {}", unreadMessages.size(), lastId);

        for (ChatMessage message : unreadMessages) {
            message.setRead(true);
            message.setReadAt(LocalDateTime.now());
            log.debug("Marking message {} as read", message.getId());
        }

        chatMessageRepository.saveAll(unreadMessages);
        log.info("Successfully saved {} messages as read", unreadMessages.size());

        webSocketService.sendReadReceipt(chatId, readerId, lastId);
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

    private ChatRoomDTO toDTO(ChatRoom chatRoom, Long userId) {
        int unreadCount = getUnreadCount(chatRoom.getId(), userId);
        return ChatRoomDTO.toDTO(chatRoom, unreadCount);
    }


}
