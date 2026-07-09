package com.project.webchat.chat.service;

import com.project.webchat.chat.dto.websocketDTOs.MessageDeletedEvent;
import com.project.webchat.chat.entity.MessageType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class WebSocketServiceTest {

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    private WebSocketService webSocketService;

    @BeforeEach
    void setUp() {
        webSocketService = new WebSocketService(messagingTemplate);
    }

    @Test
    void notifyMessageDeleted_broadcastsToChatTopicsAndMemberInboxes() {
        String messageId = "msg-1";
        String chatId = "group-1";
        Long deletedBy = 15L;
        Set<Long> members = Set.of(15L, 2L);

        webSocketService.notifyMessageDeleted(messageId, chatId, deletedBy, members);

        verify(messagingTemplate).convertAndSend(
                eq("/topic/chat/group-1/deleted"),
                org.mockito.ArgumentMatchers.<Object>argThat(payload -> payload instanceof MessageDeletedEvent event
                        && "MESSAGE_DELETED".equals(event.getType())
                        && messageId.equals(event.getMessageId())
                        && chatId.equals(event.getChatId())
                        && deletedBy.equals(event.getDeletedByUserId())));

        ArgumentCaptor<Object> messagesTopicPayload = ArgumentCaptor.forClass(Object.class);
        verify(messagingTemplate).convertAndSend(
                eq("/topic/chat/group-1/messages"),
                messagesTopicPayload.capture());
        assertThat(messagesTopicPayload.getValue()).isInstanceOf(Map.class);
        @SuppressWarnings("unchecked")
        Map<String, Object> compat = (Map<String, Object>) messagesTopicPayload.getValue();
        assertThat(compat.get("type")).isEqualTo("MESSAGE_DELETED");
        assertThat(compat.get("messageId")).isEqualTo(messageId);
        assertThat(compat.get("chatId")).isEqualTo(chatId);

        verify(messagingTemplate).convertAndSend(eq("/topic/users/15/inbox"), any(Object.class));
        verify(messagingTemplate).convertAndSend(eq("/topic/users/2/inbox"), any(Object.class));
    }

    @Test
    void notifyChatDeleted_notifiesOnlyTargetMembersNotChatTopic() {
        String chatId = "channel-1";
        Set<Long> members = Set.of(42L);

        webSocketService.notifyChatDeleted(chatId, members);

        verify(messagingTemplate).convertAndSendToUser(
                eq("42"),
                eq("/queue/chats/deleted"),
                org.mockito.ArgumentMatchers.<Object>argThat(payload -> payload instanceof com.project.webchat.chat.dto.websocketDTOs.ChatRoomDeletedEvent event
                        && "CHAT_DELETED".equals(event.getType())
                        && chatId.equals(event.getChatId())));
        verify(messagingTemplate).convertAndSend(eq("/topic/users/42/inbox"), any(Object.class));
        verify(messagingTemplate, org.mockito.Mockito.never()).convertAndSend(
                eq("/topic/chat/channel-1/messages"),
                any(Object.class));
    }

    @Test
    void notifyMessageEdited_broadcastsToChatTopicsAndMemberInboxes() {
        String messageId = "msg-2";
        String chatId = "group-1";
        Long editorId = 15L;
        LocalDateTime editedAt = LocalDateTime.of(2026, 6, 24, 10, 0);
        List<Long> members = List.of(15L, 2L);

        webSocketService.notifyMessageEdited(
                messageId,
                chatId,
                "updated text",
                editorId,
                editedAt,
                MessageType.TEXT,
                members);

        verify(messagingTemplate).convertAndSend(eq("/topic/chat/group-1/edited"), any(Object.class));
        verify(messagingTemplate).convertAndSend(eq("/topic/chat/group-1/messages"), any(Object.class));
        verify(messagingTemplate, atLeastOnce()).convertAndSend(eq("/topic/users/2/inbox"), any(Object.class));
    }
}
