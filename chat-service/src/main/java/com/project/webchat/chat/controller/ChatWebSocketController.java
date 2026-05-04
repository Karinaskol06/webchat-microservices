package com.project.webchat.chat.controller;

import com.project.webchat.chat.dto.SendMessageRequest;
import com.project.webchat.chat.dto.websocketDTOs.SendMessageWsRequest;
import com.project.webchat.chat.dto.websocketDTOs.TypingWsRequest;
import com.project.webchat.chat.service.ChatService;
import com.project.webchat.chat.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatWebSocketController {

    private final ChatService chatService;
    private final WebSocketService webSocketService;

    @MessageMapping("/chat.send")
    public void sendMessage(SendMessageWsRequest request, Principal principal) {
        Long senderId = resolveAuthenticatedUserId(principal);
        if (!request.isValid()) {
            throw new IllegalArgumentException("Message must have either content or attachments.");
        }

        // Mixed message (text + attachments)
        if (request.hasContent() && request.hasAttachments()) {
            chatService.sendMixedMessage(
                    senderId,
                    request.getChatId(),
                    request.getContent(),
                    request.getAttachmentIds(),
                    request.getType()
            );
            return;
        }

        // Only text message
        if (request.hasContent()) {
            SendMessageRequest sendMessageRequest = SendMessageRequest.builder()
                    .chatId(request.getChatId())
                    .content(request.getContent())
                    .type(request.getType())
                    .build();
            chatService.sendMessage(senderId, sendMessageRequest);
            return;
        }

        // Only attachments (no text)
        if (request.hasAttachments()) {
            chatService.sendAttachmentsOnlyMessage(
                    senderId,
                    request.getChatId(),
                    request.getAttachmentIds(),
                    request.getType()
            );
        }
    }

    @MessageMapping("/chat.typing")
    public void typing(TypingWsRequest request, Principal principal) {
        Long userId = resolveAuthenticatedUserId(principal);
        if (userId == null || request.getChatId() == null || request.getChatId().isBlank()) {
            return;
        }
        webSocketService.sendTypingMessage(request.getChatId(), userId, request.isTyping());
    }

    /* helper methods */
    private Long resolveAuthenticatedUserId(Principal principal) {
        if (principal == null || principal.getName() == null) {
            throw new SecurityException("Unauthenticated websocket client");
        }
        try {
            return Long.parseLong(principal.getName());
        } catch (NumberFormatException e) {
            log.warn("Invalid websocket principal format: {}", principal.getName());
            throw new SecurityException("Invalid websocket principal");
        }
    }
}
