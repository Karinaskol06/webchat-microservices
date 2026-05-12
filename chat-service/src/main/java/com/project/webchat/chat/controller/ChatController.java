package com.project.webchat.chat.controller;

import com.project.webchat.chat.dto.AdminMutationRequest;
import com.project.webchat.chat.dto.BootstrapMessageRequest;
import com.project.webchat.chat.dto.BootstrapMessageResponse;
import com.project.webchat.chat.dto.ChatMessageDTO;
import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.dto.CreateChatRequest;
import com.project.webchat.chat.dto.CreateGroupChannelRequest;
import com.project.webchat.chat.dto.DiscoverableRoomDTO;
import com.project.webchat.chat.dto.EditMessageRequest;
import com.project.webchat.chat.dto.InvitePayloadDTO;
import com.project.webchat.chat.dto.JoinInviteRequest;
import com.project.webchat.chat.security.CustomUserDetails;
import com.project.webchat.chat.service.ChatService;
import com.project.webchat.chat.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@Slf4j
@RequestMapping("/api/chat")
@Validated
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

        webSocketService.notifyChatCreated(currentUser.getId(), chat);

        return ResponseEntity.status(HttpStatus.CREATED).body(chat);
    }

    @PostMapping("/bootstrap-message")
    public ResponseEntity<BootstrapMessageResponse> bootstrapMessage(
            @AuthenticationPrincipal CustomUserDetails currentUser,
            @RequestBody @jakarta.validation.Valid BootstrapMessageRequest request) {
        BootstrapMessageResponse response = chatService.bootstrapFirstMessage(currentUser.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
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

    @PutMapping("/messages/{messageId}")
    public ResponseEntity<ChatMessageDTO> editMessage(
            @PathVariable String messageId,
            @RequestBody @jakarta.validation.Valid EditMessageRequest request,
            @AuthenticationPrincipal CustomUserDetails currentUser) {

        log.info("User {} is editing message {}", currentUser.getId(), messageId);
        ChatMessageDTO updatedMessage = chatService.editMessage(messageId, currentUser.getId(), request.getContent());
        return ResponseEntity.ok(updatedMessage);
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

    @PostMapping("/rooms/group")
    public ResponseEntity<ChatRoomDTO> createGroupRoom(
            @AuthenticationPrincipal CustomUserDetails currentUser,
            @RequestBody @jakarta.validation.Valid CreateGroupChannelRequest request) {
        ChatRoomDTO dto = chatService.createGroupRoom(currentUser.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @PostMapping("/rooms/channel")
    public ResponseEntity<ChatRoomDTO> createChannelRoom(
            @AuthenticationPrincipal CustomUserDetails currentUser,
            @RequestBody @jakarta.validation.Valid CreateGroupChannelRequest request) {
        ChatRoomDTO dto = chatService.createChannelRoom(currentUser.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping("/discover")
    public ResponseEntity<Page<DiscoverableRoomDTO>> discoverRooms(
            @AuthenticationPrincipal CustomUserDetails currentUser,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20, sort = "lastActivity", direction = Sort.Direction.DESC)
            Pageable pageable) {
        Page<DiscoverableRoomDTO> page = chatService.discoverPublicRooms(currentUser.getId(), q, pageable);
        return ResponseEntity.ok(page);
    }

    @PostMapping("/rooms/{id}/join")
    public ResponseEntity<ChatRoomDTO> joinPublicRoom(
            @PathVariable String id,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        ChatRoomDTO dto = chatService.joinPublicRoom(id, currentUser.getId());
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/join-invite")
    public ResponseEntity<ChatRoomDTO> joinByInvite(
            @AuthenticationPrincipal CustomUserDetails currentUser,
            @RequestBody @jakarta.validation.Valid JoinInviteRequest request) {
        ChatRoomDTO dto = chatService.joinByInvite(currentUser.getId(), request.getToken());
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/rooms/{id}/invite/regenerate")
    public ResponseEntity<InvitePayloadDTO> regenerateInvite(
            @PathVariable String id,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        InvitePayloadDTO payload = chatService.regenerateInvite(id, currentUser.getId());
        return ResponseEntity.ok(payload);
    }

    @GetMapping("/rooms/{id}/invite")
    public ResponseEntity<InvitePayloadDTO> getInvite(
            @PathVariable String id,
            @AuthenticationPrincipal CustomUserDetails currentUser) {
        InvitePayloadDTO payload = chatService.getInvitePayload(id, currentUser.getId());
        return ResponseEntity.ok(payload);
    }

    @PostMapping("/rooms/{id}/admins")
    public ResponseEntity<ChatRoomDTO> mutateGroupAdmins(
            @PathVariable String id,
            @AuthenticationPrincipal CustomUserDetails currentUser,
            @RequestBody @jakarta.validation.Valid AdminMutationRequest request) {
        ChatRoomDTO dto = chatService.mutateGroupAdmins(id, currentUser.getId(), request);
        return ResponseEntity.ok(dto);
    }

}
