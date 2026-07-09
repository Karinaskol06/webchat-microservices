package com.project.webchat.chat.service.room;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.WebSocketService;
import com.project.webchat.chat.service.support.ChatRoomEnrichmentService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserBanChatSyncServiceTest {

    @Mock
    private ChatRoomRepository chatRoomRepository;

    @Mock
    private WebSocketService webSocketService;

    @Mock
    private ChatRoomEnrichmentService roomEnrichmentService;

    @InjectMocks
    private UserBanChatSyncService userBanChatSyncService;

    @Test
    void handleUserBanned_notifiesBothUsersToHidePrivateChat() {
        ChatRoom room = ChatRoom.builder()
                .id("private-1")
                .type(ChatType.PRIVATE)
                .memberIds(Set.of(1L, 2L))
                .build();
        when(chatRoomRepository.findPrivateChatBetweenUsers(ChatType.PRIVATE, List.of(1L, 2L)))
                .thenReturn(Optional.of(room));

        userBanChatSyncService.handleUserBanned(1L, 2L);

        verify(webSocketService).notifyChatDeleted("private-1", Set.of(1L, 2L));
    }

    @Test
    void handleUserBanned_noPrivateChat_isNoOp() {
        when(chatRoomRepository.findPrivateChatBetweenUsers(ChatType.PRIVATE, List.of(1L, 2L)))
                .thenReturn(Optional.empty());

        userBanChatSyncService.handleUserBanned(1L, 2L);

        verifyNoInteractions(webSocketService);
    }

    @Test
    void handleUserUnbanned_notifiesBothUsersToRestorePrivateChat() {
        ChatRoom room = ChatRoom.builder()
                .id("private-1")
                .type(ChatType.PRIVATE)
                .memberIds(Set.of(1L, 2L))
                .build();
        when(chatRoomRepository.findPrivateChatBetweenUsers(ChatType.PRIVATE, List.of(1L, 2L)))
                .thenReturn(Optional.of(room));
        when(roomEnrichmentService.getUnreadCount("private-1", 1L)).thenReturn(0);
        when(roomEnrichmentService.getUnreadCount("private-1", 2L)).thenReturn(3);

        userBanChatSyncService.handleUserUnbanned(1L, 2L);

        verify(webSocketService).notifyChatCreated(eq(1L), org.mockito.ArgumentMatchers.any());
        verify(webSocketService).notifyChatCreated(eq(2L), org.mockito.ArgumentMatchers.any());
    }
}
