package com.project.webchat.notification.controller;

import com.project.webchat.notification.dto.PushSubscriptionRequest;
import com.project.webchat.notification.dto.PushSubscriptionResponse;
import com.project.webchat.notification.security.JwtUserIdExtractor;
import com.project.webchat.notification.service.PushSubscriptionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications/subscriptions")
@RequiredArgsConstructor
public class NotificationSubscriptionController {

    private final PushSubscriptionService pushSubscriptionService;
    private final JwtUserIdExtractor jwtUserIdExtractor;

    @PostMapping
    public ResponseEntity<PushSubscriptionResponse> upsertSubscription(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = "User-Agent", required = false) String userAgent,
            @Valid @RequestBody PushSubscriptionRequest request) {
        Long userId = jwtUserIdExtractor.extractUserId(jwt);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(PushSubscriptionResponse.from(
                        pushSubscriptionService.upsert(userId, request, userAgent)
                ));
    }

    @GetMapping
    public ResponseEntity<List<PushSubscriptionResponse>> getMySubscriptions(
            @AuthenticationPrincipal Jwt jwt) {
        Long userId = jwtUserIdExtractor.extractUserId(jwt);
        List<PushSubscriptionResponse> response = pushSubscriptionService.getByUserId(userId)
                .stream()
                .map(PushSubscriptionResponse::from)
                .toList();

        return ResponseEntity.ok(response);
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteSubscription(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("endpoint") String endpoint) {
        Long userId = jwtUserIdExtractor.extractUserId(jwt);
        pushSubscriptionService.deleteByEndpoint(userId, endpoint);

        return ResponseEntity.noContent().build();
    }
}
