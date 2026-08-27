package com.project.webchat.user.feign;

import com.project.webchat.user.config.FeignConfig;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;

@FeignClient(
        name = "chat-service",
        url = "${feign.client.chat-service.url:}",
        configuration = FeignConfig.class)
public interface ChatServiceClient {

    @PostMapping("/api/chat/internal/users/{userId}/account-deleted")
    ResponseEntity<Void> handleAccountDeleted(@PathVariable("userId") Long userId);

    @PostMapping("/api/chat/internal/users/{bannerId}/banned/{targetUserId}")
    ResponseEntity<Void> handleUserBanned(
            @PathVariable("bannerId") Long bannerId,
            @PathVariable("targetUserId") Long targetUserId);

    @DeleteMapping("/api/chat/internal/users/{bannerId}/banned/{targetUserId}")
    ResponseEntity<Void> handleUserUnbanned(
            @PathVariable("bannerId") Long bannerId,
            @PathVariable("targetUserId") Long targetUserId);
}
