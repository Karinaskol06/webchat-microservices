package com.project.webchat.chat.controller;

import com.project.webchat.chat.dto.ChatMessageDTO;
import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.dto.CreateChatRequest;
import com.project.webchat.chat.dto.SendMessageRequest;
import com.project.webchat.chat.security.CustomUserDetails;
import com.project.webchat.chat.service.ChatService;
import com.project.webchat.chat.service.WebSocketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@Slf4j
@RequestMapping("/api/chat")
public class ChatController {

    private final ChatService chatService;
    private final WebSocketService webSocketService;

    //create a private chat between users
    @PostMapping("/create")
    public ResponseEntity<ChatRoomDTO> create(
            @RequestBody CreateChatRequest createChatRequest,
            @AuthenticationPrincipal CustomUserDetails currentUser) {

        log.info("Creating a private chat between users {} and {}",
                currentUser.getId(), createChatRequest.getOtherUserId());

        ChatRoomDTO chat = chatService.createChat(
                currentUser.getId(), createChatRequest.getOtherUserId());

        return ResponseEntity.status(HttpStatus.CREATED).body(chat);
    }

    //get all chats for the authenticated user
    @GetMapping
    public ResponseEntity<Page<ChatRoomDTO>> getAllUserChats(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PageableDefault(size = 20, sort = "lastActivity", direction = Sort.Direction.DESC)
            Pageable pageable) {

        log.info("Fetching chats for user {}", userDetails.getId());
        Page<ChatRoomDTO> chats = chatService.getAllUserChatsSorted(
                userDetails.getId(), pageable);

        return ResponseEntity.ok(chats);
    }

    //send a message to a chat
    @PostMapping("/{chatId}/messages")
    public ResponseEntity<ChatMessageDTO> sendMessage(
            @PathVariable String chatId,
            @RequestBody @Valid SendMessageRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {

        log.info("User {} is sending a message to chat {}", currentUser.getId(), chatId);

        request.setChatId(chatId);
        ChatMessageDTO massage = chatService.sendMessage(currentUser.getId(), request);

        return ResponseEntity.status(HttpStatus.CREATED).body(massage);
    }

    //get message history for a chat
    @GetMapping("/{chatId}/messages")
    public ResponseEntity<Page<ChatMessageDTO>> getAllMessages(
            @PathVariable String chatId,
            @AuthenticationPrincipal CustomUserDetails currentUser,
            // return newest messages by default (page 0 = latest)
            @PageableDefault(size = 50, sort = "timestamp", direction = Sort.Direction.DESC)
            Pageable pageable) {

        log.info("Fetching chat message for user {} from {}", currentUser.getId(), chatId);

        if (!chatService.isUserChatMember(chatId, currentUser.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

        Page<ChatMessageDTO> messages = chatService.getMessageHistory(chatId, currentUser.getId(), pageable);
        return ResponseEntity.ok(messages);
    }

    @PostMapping("/{chatId}/typing")
    public ResponseEntity<Void> typing(
            @PathVariable String chatId,
            @RequestBody(required = false) Map<String, Object> body,
            @AuthenticationPrincipal CustomUserDetails userTyping) {
        log.debug("User {} is typing in chat {}", userTyping.getId(), chatId);

        boolean isTyping = true;
        if (body != null && body.containsKey("typing")) {
            Object raw = body.get("typing");
            if (raw instanceof Boolean b) {
                isTyping = b;
            } else if (raw instanceof String s) {
                isTyping = Boolean.parseBoolean(s);
            }
        }
        webSocketService.sendTypingMessage(chatId, userTyping.getId(), isTyping);

        return ResponseEntity.ok().build();
    }

    //mark messages as read in a chat
    @PostMapping("/{chatId}/read")
    public ResponseEntity<Void> markAsRead(
            @PathVariable String chatId,
            @AuthenticationPrincipal CustomUserDetails currentUser) {

        log.info("User {} is marking a read in a chat {}", currentUser.getId(), chatId);
        chatService.markMessagesAsRead(chatId, currentUser.getId());

        return ResponseEntity.ok().build();
    }

    //get unread count for a specific chat
    @GetMapping("/{chatId}/unread-count")
    public ResponseEntity<Map<String, Integer>> getUnreadCount(
            @PathVariable String chatId,
            @AuthenticationPrincipal CustomUserDetails currentUser) {

        int unreadCount = chatService.getUnreadCount(chatId, currentUser.getId());

        return ResponseEntity.ok(Map.of("unreadCount", unreadCount));
    }

    //delete a message
    @DeleteMapping("/messages/{messageId}")
    public ResponseEntity<Void> deleteMessage(
            @PathVariable String messageId,
            @AuthenticationPrincipal CustomUserDetails currentUser) {

        log.info("User {} is deleting message {}", currentUser.getId(), messageId);
        chatService.deleteMessage(messageId, currentUser.getId());
        return ResponseEntity.noContent().build();
    }

    //leave a chat
    @PostMapping("/{chatId}/leave")
    public ResponseEntity<Void> leaveChat(
            @PathVariable String chatId,
            @AuthenticationPrincipal CustomUserDetails currentUser) {

        log.info("User {} is leaving chat {}", currentUser.getId(), chatId);
        chatService.leaveChat(chatId, currentUser.getId());
        return ResponseEntity.ok().build();
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgumentException(
            IllegalArgumentException e) {
        log.error("Illegal argument: {}", e.getMessage());
        return ResponseEntity.badRequest()
                .body(Map.of("error", e.getMessage()));
    }

}
