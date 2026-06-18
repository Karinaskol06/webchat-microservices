package com.project.webchat.user.feign;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;

@FeignClient(name = "chat-service", url = "${feign.client.chat-service.url:}")
public interface ChatServiceClient {

    @PostMapping("/api/chat/internal/users/{userId}/account-deleted")
    ResponseEntity<Void> handleAccountDeleted(@PathVariable("userId") Long userId);
}
