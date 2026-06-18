package com.project.webchat.chat.controller;

import com.project.webchat.chat.service.room.UserAccountDeletionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chat/internal")
@RequiredArgsConstructor
public class ChatInternalController {

    private final UserAccountDeletionService userAccountDeletionService;

    @PostMapping("/users/{userId}/account-deleted")
    public ResponseEntity<Void> handleAccountDeleted(@PathVariable Long userId) {
        userAccountDeletionService.handleAccountDeleted(userId);
        return ResponseEntity.noContent().build();
    }
}
