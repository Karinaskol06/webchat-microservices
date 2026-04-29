package com.project.webchat.chat.service;

import com.project.webchat.chat.dto.*;
import com.project.webchat.chat.dto.websocketDTOs.*;
import com.project.webchat.chat.entity.Attachment;
import com.project.webchat.chat.entity.ChatMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

@Service
@Slf4j
@RequiredArgsConstructor
public class WebSocketService {

    private final SimpMessagingTemplate messagingTemplate;

    // ========== CONSTANTS ==========
    private static final String TOPIC_CHAT_MESSAGES = "/topic/chat/%s/messages";
    private static final String TOPIC_CHAT_TYPING = "/topic/chat/%s/typing";
    private static final String TOPIC_CHAT_READ = "/topic/chat/%s/read";
    private static final String TOPIC_CHAT_PRESENCE = "/topic/chat/%s/presence";
    private static final String TOPIC_CHAT_DELETED = "/topic/chat/%s/deleted";
    private static final String TOPIC_CHAT_EDITED = "/topic/chat/%s/edited";
    private static final String TOPIC_CHAT_ATTACHMENT = "/topic/chat/%s/attachment";

    // User queues for personal messages
    private static final String QUEUE_CHATS_NEW = "/queue/chats/new";
    private static final String QUEUE_CHATS_UPDATED = "/queue/chats/updated";
    private static final String QUEUE_CHATS_DELETED = "/queue/chats/deleted";
    private static final String QUEUE_CHATS_USER_LEFT = "/queue/chats/user-left";
    private static final String QUEUE_FRIEND_REQUESTS_NEW = "/queue/friends/requests/new";
    private static final String QUEUE_FRIEND_REQUESTS_UPDATED = "/queue/friends/requests/updated";
    private static final String QUEUE_FRIEND_ACCEPTED = "/queue/friends/accepted";

    // ========== MESSAGING EVENTS ==========
    public void sendMessageToChat(String chatId, ChatMessageDTO message) {
        MessageSentEvent event = new MessageSentEvent(message);
        sendToChatTopic(TOPIC_CHAT_MESSAGES, chatId, event);
        log.info("Message {} sent to chat {}", message.getId(), chatId);
    }

    public void sendMixedMessageToChat(String chatId, ChatMessage message, List<Attachment> attachments) {
        MessageWithAttachmentsDTO dto = MessageWithAttachmentsDTO.fromEntity(message, attachments);
        sendToChatTopic(TOPIC_CHAT_MESSAGES, chatId, dto);
        log.info("Mixed message sent to chat {}: hasText={}, attachmentsCount={}",
                chatId, message.getContent() != null, attachments.size());
    }

    public void notifyMessageDeleted(String messageId, String chatId, Long deletedByUserId) {
        MessageDeletedEvent event = new MessageDeletedEvent(messageId, chatId, deletedByUserId);
        sendToChatTopic(TOPIC_CHAT_DELETED, chatId, event);
        log.info("Message {} deleted from chat {} by user {}", messageId, chatId, deletedByUserId);
    }

    public void notifyMessageEdited(String messageId, String chatId, String newContent, Long editedByUserId) {
        MessageEditedEvent event = new MessageEditedEvent(messageId, chatId, newContent, editedByUserId);
        sendToChatTopic(TOPIC_CHAT_EDITED, chatId, event);
        log.info("Message {} edited in chat {} by user {}", messageId, chatId, editedByUserId);
    }

    public void notifyAttachmentAdded(String chatId, String messageId, AttachmentDTO attachment) {
        AttachmentAddedEvent event = new AttachmentAddedEvent(messageId, attachment);
        sendToChatTopic(TOPIC_CHAT_ATTACHMENT, chatId, event);
        log.info("Attachment {} added to message {} in chat {}", attachment.getId(), messageId, chatId);
    }

    public void notifyAttachmentDeleted(String chatId, String messageId, String attachmentId, Long deletedByUserId) {
        AttachmentDeletedEvent event = new AttachmentDeletedEvent(messageId, attachmentId, deletedByUserId);
        sendToChatTopic(TOPIC_CHAT_ATTACHMENT, chatId, event);
        log.info("Attachment {} deleted from message {} in chat {} by user {}",
                attachmentId, messageId, chatId, deletedByUserId);
    }

    // ========== CHAT EVENTS (CRUD) ==========
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

    // ========== FRIEND REQUESTS EVENTS ==========
    /*
    public void notifyNewFriendRequest(Long receiverId, FriendRequestDTO request) {
        sendToUserQueue(receiverId, QUEUE_FRIEND_REQUESTS_NEW, request);
        log.info("New friend request from {} to user {}", request.getFromUserId(), receiverId);
    }

    public void notifyFriendRequestUpdated(Long requesterId, FriendRequestDTO request) {
        sendToUserQueue(requesterId, QUEUE_FRIEND_REQUESTS_UPDATED, request);
        log.info("Friend request {} updated for user {}", request.getId(), requesterId);
    }

    public void notifyFriendRequestAccepted(Long requesterId, FriendDTO newFriend) {
        sendToUserQueue(requesterId, QUEUE_FRIEND_ACCEPTED, newFriend);
        log.info("Friend request accepted, user {} now friends with {}",
                requesterId, newFriend.getId());
    }
    */

    // ========== TYPING & PRESENCE ==========
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

    // ========== PRIVATE HELPER METHODS ==========
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

    // ========== INNER EVENT CLASSES ==========
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
    public static class AttachmentAddedEvent {
        private String messageId;
        private AttachmentDTO attachment;
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    public static class AttachmentDeletedEvent {
        private String messageId;
        private String attachmentId;
        private Long deletedByUserId;
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    public static class MessageEditedEvent {
        private String messageId;
        private String chatId;
        private String newContent;
        private Long editedByUserId;
    }

    @lombok.Data
    @lombok.AllArgsConstructor
    public static class MessageDeletedEvent {
        private String messageId;
        private String chatId;
        private Long deletedByUserId;
    }
}