package com.project.webchat.chat.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.webchat.chat.dto.ChatMessageDTO;
import com.project.webchat.chat.dto.websocketDTOs.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class WebSocketService {

    private final SimpMessagingTemplate messagingTemplate;

    //constants for destination patterns
    private static final String CHAT_MESSAGES_DEST = "/topic/chat.%s.messages";
    private static final String CHAT_TYPING_DEST = "/topic/chat.%s.typing";
    private static final String CHAT_READ_DEST = "/topic/chat.%s.read";
    private static final String CHAT_PRESENCE_DEST = "/topic/chat.%s.presence";

    /* Messaging events */

    //sending a message to all chat members
    public void sendMessageToChat(String chatId, ChatMessageDTO message) {
        MessageSentEvent event = new MessageSentEvent(message);
        messagingTemplate.convertAndSend(formatDest(CHAT_MESSAGES_DEST, chatId), event);
        log.info("Message {} sent to chat {}", message.getChatId(), chatId);
    }

    //deleting a message from the chat
    public void notifyMessageDeleted(String messageId, String chatId) {
        MessageDeletedEvent event = new MessageDeletedEvent(messageId, chatId);
        messagingTemplate.convertAndSend(formatDest(CHAT_MESSAGES_DEST, chatId), event);
        log.info("Message {} deleted from chat {}", messageId, chatId);
    }

    //editing a message in a chat
    public void editMessageInChat(String messageId, String chatId, String newContent) {
        MessageEditedEvent event = new MessageEditedEvent(chatId, messageId, newContent);
        messagingTemplate.convertAndSend(formatDest(CHAT_MESSAGES_DEST, chatId), event);
        log.info("Message {} edited in chat {}", messageId, chatId);
    }

    /* Typing */

    //sending a message about typing
    public void sendTypingMessage(String chatId, Long userId, boolean isTyping) {
        TypingEvent event = new TypingEvent(userId, isTyping);
        messagingTemplate.convertAndSend(formatDest(CHAT_TYPING_DEST, chatId), event);
        log.debug("User {} typing: {} in chat {}", userId, isTyping, chatId);
    }

    //sending a message about reading
    public void sendReadReceipt(String chatId, Long senderId, String messageId) {
        ReadReceiptEvent event = new ReadReceiptEvent(senderId, messageId);
        messagingTemplate.convertAndSend(formatDest(CHAT_READ_DEST, chatId), event);
        log.debug("User {} read message {} in chat {}", senderId, messageId, chatId);
    }

    /* Presence events */

    //online in chat
    public void notifyUserJoinedChat(String chatId, Long userId) {
        UserJoinedEvent event = new UserJoinedEvent(userId);
        messagingTemplate.convertAndSend(formatDest(CHAT_PRESENCE_DEST, chatId), event);
        log.info("User {} joined chat {}", userId, chatId);
    }

    //left chat
    public void notifyUserLeftChat(String chatId, Long userId) {
        UserLeftEvent event = new UserLeftEvent(userId);
        messagingTemplate.convertAndSend(formatDest(CHAT_PRESENCE_DEST, chatId), event);
        log.info("User {} left chat {}", userId, chatId);
    }

    /* helper methods */

    //instead of convertAndSend("/topic/chat." + chatId + ".messages", event)
    //%s placeholder is replaced with chatId parameter
    private String formatDest(String pattern, String chatId) {
        return String.format(pattern, chatId);
    }

}
