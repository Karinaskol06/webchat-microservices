package com.project.webchat.user.controller;

import com.project.webchat.shared.dto.UserBanStatusDTO;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.user.service.UserBanService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * HTTP adapter for user-ban routes (frontend + internal Feign).
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserBanHttpAdapter {

    private final UserBanService userBanService;

    @PostMapping("/bans/{targetUserId}")
    public ResponseEntity<Void> banUser(
            @PathVariable Long targetUserId,
            @RequestHeader("X-User-Id") Long currentUserId) {
        userBanService.banUser(currentUserId, targetUserId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/bans/{targetUserId}")
    public ResponseEntity<Void> unbanUser(
            @PathVariable Long targetUserId,
            @RequestHeader("X-User-Id") Long currentUserId) {
        userBanService.unbanUser(currentUserId, targetUserId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/bans")
    public ResponseEntity<List<UserDTO>> listBannedUsers(
            @RequestHeader("X-User-Id") Long currentUserId) {
        return ResponseEntity.ok(userBanService.listBannedUsers(currentUserId));
    }

    @GetMapping("/bans/status/{targetUserId}")
    public ResponseEntity<UserBanStatusDTO> getBanStatus(
            @PathVariable Long targetUserId,
            @RequestHeader("X-User-Id") Long currentUserId) {
        return ResponseEntity.ok(userBanService.getBanStatus(currentUserId, targetUserId));
    }

    @GetMapping("/internal/{userId}/banned-user-ids")
    public ResponseEntity<List<Long>> getBannedUserIdsInternal(@PathVariable Long userId) {
        return ResponseEntity.ok(userBanService.listBannedUserIds(userId));
    }

    @GetMapping("/internal/{userId}/banning-user-ids")
    public ResponseEntity<List<Long>> getBanningUserIdsInternal(@PathVariable Long userId) {
        return ResponseEntity.ok(userBanService.listBanningUserIds(userId));
    }

    @GetMapping("/internal/{userId}/has-banned/{targetUserId}")
    public ResponseEntity<Boolean> hasBannedInternal(
            @PathVariable Long userId,
            @PathVariable Long targetUserId) {
        return ResponseEntity.ok(userBanService.hasBanned(userId, targetUserId));
    }
}
