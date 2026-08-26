package com.project.webchat.user.controller;

import com.project.webchat.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * HTTP adapter for internal last-seen / presence routes.
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserPresenceHttpAdapter {

    private final UserService userService;

    @PutMapping("/internal/{userId}/last-seen")
    public ResponseEntity<Void> updateLastSeenInternal(
            @PathVariable Long userId,
            @RequestParam("epochMillis") long epochMillis) {
        userService.updateLastSeen(userId, epochMillis);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/internal/{userId}/last-seen")
    public ResponseEntity<Long> getLastSeenInternal(@PathVariable Long userId) {
        Long lastSeen = userService.getLastSeenEpochMillis(userId);
        if (lastSeen == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(lastSeen);
    }
}
