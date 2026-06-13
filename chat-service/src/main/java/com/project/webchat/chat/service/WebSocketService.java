package com.project.webchat.chat.service;

import com.project.webchat.chat.dto.*;
import com.project.webchat.chat.dto.websocketDTOs.*;
import com.project.webchat.chat.entity.MessageType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@Service
@Slf4j
@RequiredArgsConstructor
public class WebSocketService {

    private final SimpMessagingTemplate messagingTemplate;

    // Constants
    private static final String TOPIC_CHAT_MESSAGES = "/topic/chat/%s/messages";
    private static final String TOPIC_CHAT_TYPING = "/topic/chat/%s/typing";
    private static final String TOPIC_CHAT_READ = "/topic/chat/%s/read";
    private static final String TOPIC_CHAT_PRESENCE = "/topic/chat/%s/presence";
    private static final String TOPIC_CHAT_DELETED = "/topic/chat/%s/deleted";
    private static final String TOPIC_CHAT_EDITED = "/topic/chat/%s/edited";
    private static final String TOPIC_CHAT_REACTIONS = "/topic/chat/%s/reactions";
    private static final String TOPIC_CHAT_ATTACHMENT = "/topic/chat/%s/attachment";

    // User queues for personal messages
    private static final String QUEUE_CHATS_NEW = "/queue/chats/new";
    private static final String QUEUE_CHATS_UPDATED = "/queue/chats/updated";
    private static final String QUEUE_CHATS_DELETED = "/queue/chats/deleted";
    private static final String QUEUE_CHATS_USER_LEFT = "/queue/chats/user-left";
    private static final String QUEUE_ROOM_MEMBER_INVITES_NEW = "/queue/rooms/member-invites/new";

    // Messaging events
    public void sendMessageToChat(String chatId, ChatMessageDTO message) {
        MessageSentEvent event = new MessageSentEvent(message);
        sendToChatTopic(TOPIC_CHAT_MESSAGES, chatId, event);
        log.info("Message {} sent to chat {}", message.getId(), chatId);
    }

    public void notifyMessageDeleted(String messageId, String chatId, Long deletedByUserId) {
        MessageDeletedEvent event = new MessageDeletedEvent(messageId, chatId, deletedByUserId);
        sendToChatTopic(TOPIC_CHAT_DELETED, chatId, event);
        log.info("Message {} deleted from chat {} by user {}", messageId, chatId, deletedByUserId);
    }

    public void notifyMessageEdited(String messageId, String chatId, String newContent, Long editedByUserId,
                                    LocalDateTime editedAt, MessageType newMessageType) {
        MessageEditedEvent event = new MessageEditedEvent(
                messageId, chatId, newContent, editedByUserId, editedAt, newMessageType);
        sendToChatTopic(TOPIC_CHAT_EDITED, chatId, event);
        log.info("Message {} edited in chat {} by user {}", messageId, chatId, editedByUserId);
    }

    public void notifyMessageReactionUpdated(String messageId, String chatId, List<MessageReactionDTO> reactions) {
        List<MessageReactionDTO> broadcastPayload = reactions.stream()
                .map(r -> MessageReactionDTO.builder()
                        .emoji(r.getEmoji())
                        .count(r.getCount())
                        .userIds(r.getUserIds())
                        .build())
                .toList();
        MessageReactionUpdatedEvent event = new MessageReactionUpdatedEvent(messageId, chatId, broadcastPayload);
        sendToChatTopic(TOPIC_CHAT_REACTIONS, chatId, event);
        log.debug("Reactions updated on message {} in chat {}", messageId, chatId);
    }

    // Chat events (CRUD)
    public void notifyChatCreated(Long userId, ChatRoomDTO chatRoom) {
        sendToUserQueue(userId, QUEUE_CHATS_NEW, chatRoom);
        log.info("Chat {} created for user {}", chatRoom.getId(), userId);
    }

    public void notifyChatUpdated(String chatId, ChatRoomDTO chatRoom, Set<Long> memberIds) {
        for (Long memberId : memberIds) {
            sendToUserQueue(memberId, QUEUE_CHATS_UPDATED, chatRoom);
        }
        log.info("Chat {} updated, notified {} members", chatId, memberIds.size());
    }

    public void notifyChatDeleted(String chatId, Set<Long> memberIds) {
        ChatDeletedEvent event = new ChatDeletedEvent(chatId);
        for (Long memberId : memberIds) {
            sendToUserQueue(memberId, QUEUE_CHATS_DELETED, event);
        }
        log.info("Chat {} deleted, notified {} members", chatId, memberIds.size());
    }

    public void notifyUserLeftChatForAll(String chatId, Long userId, Set<Long> otherMembers) {
        UserLeftChatEvent event = new UserLeftChatEvent(chatId, userId);
        for (Long memberId : otherMembers) {
            sendToUserQueue(memberId, QUEUE_CHATS_USER_LEFT, event);
        }
        log.info("User {} left chat {}, notified {} members", userId, chatId, otherMembers.size());
    }

    public void notifyRoomMemberInvite(Long inviteeUserId, RoomMemberInviteDTO invite) {
        sendToUserQueue(inviteeUserId, QUEUE_ROOM_MEMBER_INVITES_NEW, invite);
        log.info("Room member invite {} sent to user {}", invite.getId(), inviteeUserId);
    }

    // Typing and presence
    public void sendTypingMessage(String chatId, Long userId, boolean isTyping) {
        TypingEvent event = new TypingEvent(userId, isTyping);
        sendToChatTopic(TOPIC_CHAT_TYPING, chatId, event);
        log.debug("User {} typing: {} in chat {}", userId, isTyping, chatId);
    }

    public void sendReadReceipt(String chatId, Long readerId, List<String> messageIds) {
        ReadReceiptEvent event = new ReadReceiptEvent(readerId, messageIds);
        sendToChatTopic(TOPIC_CHAT_READ, chatId, event);
        log.debug("User {} read {} messages in chat {}", readerId, messageIds.size(), chatId);
    }

    public void notifyUserJoinedChat(String chatId, Long userId) {
        UserJoinedEvent event = new UserJoinedEvent(userId);
        sendToChatTopic(TOPIC_CHAT_PRESENCE, chatId, event);
        log.info("User {} joined chat {}", userId, chatId);
    }

    public void notifyUserLeftChat(String chatId, Long userId) {
        UserLeftEvent event = new UserLeftEvent(userId);
        sendToChatTopic(TOPIC_CHAT_PRESENCE, chatId, event);
        log.info("User {} left chat {}", userId, chatId);
    }

    // Priv helper methods
    private void sendToChatTopic(String topicPattern, String chatId, Object payload) {
        String destination = String.format(topicPattern, chatId);
        messagingTemplate.convertAndSend(destination, payload);
    }

    private void sendToUserQueue(Long userId, String queueDestination, Object payload) {
        messagingTemplate.convertAndSendToUser(
                userId.toString(),
                queueDestination,
                payload
        );
    }

    // Inner event classes
    @lombok.Data
    @lombok.AllArgsConstructor
    public static class UserLeftChatEvent {
        private String chatId;
        private Long userId;
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    public static class ChatDeletedEvent {
        private String chatId;
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    public static class MessageEditedEvent {
        private String messageId;
        private String chatId;
        private String newContent;
        private Long editedByUserId;
        private LocalDateTime editedAt;
        private MessageType messageType;
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    public static class MessageDeletedEvent {
        private String messageId;
        private String chatId;
        private Long deletedByUserId;
    }
}