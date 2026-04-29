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
        Long senderId = resolveSenderId(principal, request.getSenderId());
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
        Long userId = resolveSenderId(principal, request.getUserId());
        if (userId == null || request.getChatId() == null || request.getChatId().isBlank()) {
            return;
        }
        webSocketService.sendTypingMessage(request.getChatId(), userId, request.isTyping());
    }

    /* helper methods */
    private Long resolveSenderId(Principal principal, Long fallbackSenderId) {
        if (principal != null && principal.getName() != null) {
            try {
                return Long.parseLong(principal.getName());
            } catch (NumberFormatException e) {
                log.debug("WebSocket principal is not numeric: {}", principal.getName());
            }
        }
        return fallbackSenderId;
    }
}
