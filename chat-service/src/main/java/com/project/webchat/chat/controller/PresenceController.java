package com.project.webchat.chat.controller;

import com.project.webchat.chat.security.CustomUserDetails;
import com.project.webchat.chat.service.ChatService;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/presence")
public class PresenceController {

    private final RedisService redisService;
    private final ChatService chatService;
    private final WebSocketService webSocketService;

    //when entering a chat
    @PostMapping("/enter-chat/{chatId}")
    public ResponseEntity<Void> enterChat(
            @PathVariable String chatId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {

        boolean isMember = chatService.isUserChatMember(chatId, userDetails.getId());
        if (!isMember) {
            return ResponseEntity.status(403).build();
        }

        redisService.markUserOnline(userDetails.getId(), chatId);
        webSocketService.notifyUserJoinedChat(chatId, userDetails.getId());
        return ResponseEntity.ok().build();
    }

    //calls periodically
    @PostMapping("/heartbeat/{chatId}")
    public ResponseEntity<Void> heartbeat(
            @PathVariable String chatId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        //update presence if user is still in the chat
        String currentChat = redisService.getCurrentChat(userDetails.getId());

        if (currentChat.equals(chatId)) {
            redisService.heartbeat(userDetails.getId());
        }

        return ResponseEntity.ok().build();
    }

    //get user's status for a specific chat
    @GetMapping("/status/{userId}/{chatId}")
    public ResponseEntity<Map<String, Object>> getStatus(
            @PathVariable Long userId,
            @PathVariable String chatId) {
        String currentUserChat = redisService.getCurrentChat(userId);
        boolean isOnlineInChat = chatId.equals(currentUserChat) && redisService.isUserOnline(userId);

        Map<String, Object> response = new HashMap<>();
        response.put("userId", userId);
        response.put("chatId", chatId);
        response.put("isOnlineInChat", isOnlineInChat);

        if (!isOnlineInChat) {
            Long lastSeen = redisService.getLastSeen(userId);
            response.put("lastSeen", lastSeen);
            response.put("lastSeenFormatted", formatLastSeen(lastSeen));
        }

        return ResponseEntity.ok(response);
    }

    //get all online users
    @GetMapping("/chat/{chatId}/online-users")
    public ResponseEntity<Set<Long>> getOnlineUsers(
            @PathVariable String chatId) {
        return ResponseEntity.ok(redisService.getOnlineUsersInChat(chatId));
    }

    //when user leaves a chat
    @PostMapping("/leave/{chatId}")
    public ResponseEntity<Void> leave(
            @PathVariable String chatId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        //if user was in this chat
        String userChatId = redisService.getCurrentChat(userDetails.getId());
        if (chatId.equals(userChatId)) {
            redisService.markUserOffline(userDetails.getId());
            webSocketService.notifyUserLeftChat(chatId, userDetails.getId());
        }
        return ResponseEntity.ok().build();
    }

    //when user closes browser
    @PostMapping("/disconnect")
    public ResponseEntity<Void> disconnect(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        String chatId = redisService.getCurrentChat(userDetails.getId());
        redisService.markUserOffline(userDetails.getId());
        if (chatId != null) {
            webSocketService.notifyUserLeftChat(chatId, userDetails.getId());
        }
        return ResponseEntity.ok().build();
    }


    /* helper methods */
    private String formatLastSeen(Long lastSeen) {

        if (lastSeen == null) {
            return "Never seen";
        }

        long difference = System.currentTimeMillis() - lastSeen;
        //60 000 ms in a minute
        long minutes = difference / (1000 * 60);

        if (minutes < 1) return "Just now";
        if (minutes < 60) return minutes + " minutes ago";

        long hours = minutes / 60;
        if (hours < 24) return hours + " hours ago";

        long days = hours / 24;
        return days + " days ago";
    }

}
