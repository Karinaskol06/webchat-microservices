package com.project.webchat.chat.config;

import com.project.webchat.chat.service.RedisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

@Component
@Slf4j
@RequiredArgsConstructor
public class WebSocketEventListener {

    private final RedisService redisService;

    @EventListener
    public void handleWebSocketListener(SessionConnectedEvent event) {
        StompHeaderAccessor headers = StompHeaderAccessor.wrap(event.getMessage());
        //gets authenticated user from websocket session
        Principal principal = headers.getUser();

        if (principal != null) {
            try {
                Long userId = Long.parseLong(principal.getName());
                log.info("User {} connected via WebSocket", userId);
            } catch (NumberFormatException e) {
                log.warn("Invalid user ID format: {}", principal.getName());
            }
        }
    }

    @EventListener
    public void handleWebSocketDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor headers = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = headers.getUser();

        if (principal != null) {
            try {
                Long userId = Long.parseLong(principal.getName());
                log.info("User {} disconnected via WebSocket", userId);

                //user disconnected - mark offline after 5s
                new Thread(() -> {
                    try {
                        Thread.sleep(5000);
                        if (!redisService.isUserOnline(userId)) {
                            redisService.markUserOffline(userId);
                        }
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                }).start();
            } catch (NumberFormatException e) {
                log.warn("Invalid user ID format: {}", principal.getName());
            }
        }
    }
}
