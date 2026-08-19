package com.project.webchat.chat.service.support;

import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.entity.RoomVisibility;
import com.project.webchat.chat.service.WebSocketService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Characterization tests for room update fan-out.
 * Targets ChatRoomUpdateNotifier once the split is complete.
 */
@ExtendWith(MockitoExtension.class)
class ChatRoomUpdateNotifierTest {

    @Mock
    private ChatRoomEnricher enricher;

    @Mock
    private WebSocketService webSocketService;

    private ChatRoomUpdateNotifier notifier;

    @BeforeEach
    void setUp() {
        notifier = new ChatRoomUpdateNotifier(enricher, webSocketService);
    }

    @Test
    void notifyRoomMembersChatUpdated_sendsPersonalizedDTOToEachMember() {
        ChatRoom room = ChatRoom.builder()
                .id("grp-notify")
                .type(ChatType.GROUP)
                .memberIds(Set.of(10L, 20L))
                .createdBy(10L)
                .groupName("Notify Test")
                .visibility(RoomVisibility.PRIVATE)
                .build();

        ChatRoomDTO dto10 = ChatRoomDTO.builder().id("grp-notify").unreadCount(1).build();
        ChatRoomDTO dto20 = ChatRoomDTO.builder().id("grp-notify").unreadCount(0).build();
        when(enricher.getUnreadCount("grp-notify", 10L)).thenReturn(1);
        when(enricher.getUnreadCount("grp-notify", 20L)).thenReturn(0);
        when(enricher.enrichChatWithUserData(room, 10L, 1)).thenReturn(dto10);
        when(enricher.enrichChatWithUserData(room, 20L, 0)).thenReturn(dto20);

        notifier.notifyRoomMembersChatUpdated(room);

        verify(webSocketService).notifyChatUpdated("grp-notify", dto10, Set.of(10L));
        verify(webSocketService).notifyChatUpdated("grp-notify", dto20, Set.of(20L));
    }

    @Test
    void notifyRoomMembersChatUpdated_emptyMemberList_noWsCalls() {
        ChatRoom room = ChatRoom.builder()
                .id("empty-room")
                .type(ChatType.GROUP)
                .memberIds(Set.of())
                .createdBy(1L)
                .build();

        notifier.notifyRoomMembersChatUpdated(room);

        verifyNoInteractions(webSocketService);
        verifyNoInteractions(enricher);
    }

    @Test
    void notifyRoomMembersChatUpdated_nullMemberList_noWsCalls() {
        ChatRoom room = ChatRoom.builder()
                .id("null-room")
                .type(ChatType.GROUP)
                .createdBy(1L)
                .build();
        room.setMemberIds(null);

        notifier.notifyRoomMembersChatUpdated(room);

        verifyNoInteractions(webSocketService);
        verifyNoInteractions(enricher);
    }
}
