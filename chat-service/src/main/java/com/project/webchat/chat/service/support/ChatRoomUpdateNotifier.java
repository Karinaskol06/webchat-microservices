package com.project.webchat.chat.service.support;

import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Set;

/**
 * Room update fan-out: enriches a {@link ChatRoom} per member and pushes
 * the personalized {@link ChatRoomDTO} over WebSocket to each of them.
 */
@Service
@RequiredArgsConstructor
public class ChatRoomUpdateNotifier {

    private final ChatRoomEnricher enricher;
    private final WebSocketService webSocketService;

    /** Sends a personalized room-updated event to every current member of {@code room}. */
    public void notifyRoomMembersChatUpdated(ChatRoom room) {
        if (room.getMemberIds() == null || room.getMemberIds().isEmpty()) {
            return;
        }
        for (Long memberId : new HashSet<>(room.getMemberIds())) {
            ChatRoomDTO dto = enricher.enrichChatWithUserData(
                    room, memberId, enricher.getUnreadCount(room.getId(), memberId));
            webSocketService.notifyChatUpdated(room.getId(), dto, Set.of(memberId));
        }
    }
}
