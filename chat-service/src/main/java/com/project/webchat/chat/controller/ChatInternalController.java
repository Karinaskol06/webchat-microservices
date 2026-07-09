package com.project.webchat.chat.controller;

import com.project.webchat.chat.service.room.UserAccountDeletionService;
import com.project.webchat.chat.service.room.UserBanChatSyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chat/internal")
@RequiredArgsConstructor
public class ChatInternalController {

    private final UserAccountDeletionService userAccountDeletionService;
    private final UserBanChatSyncService userBanChatSyncService;

    @PostMapping("/users/{userId}/account-deleted")
    public ResponseEntity<Void> handleAccountDeleted(@PathVariable Long userId) {
        userAccountDeletionService.handleAccountDeleted(userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/users/{bannerId}/banned/{targetUserId}")
    public ResponseEntity<Void> handleUserBanned(
            @PathVariable Long bannerId,
            @PathVariable Long targetUserId) {
        userBanChatSyncService.handleUserBanned(bannerId, targetUserId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{bannerId}/banned/{targetUserId}")
    public ResponseEntity<Void> handleUserUnbanned(
            @PathVariable Long bannerId,
            @PathVariable Long targetUserId) {
        userBanChatSyncService.handleUserUnbanned(bannerId, targetUserId);
        return ResponseEntity.noContent().build();
    }
}
