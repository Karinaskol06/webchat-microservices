package com.project.webchat.chat.service.room;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.WebSocketService;
import com.project.webchat.chat.service.support.ChatRoomEnricher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserBanChatSyncService {

    private final ChatRoomRepository chatRoomRepository;
    private final WebSocketService webSocketService;
    private final ChatRoomEnricher roomEnricher;

    public void handleUserBanned(Long bannerId, Long targetUserId) {
        if (bannerId == null || targetUserId == null || bannerId.equals(targetUserId)) {
            return;
        }
        findPrivateChat(bannerId, targetUserId).ifPresent(room -> {
            webSocketService.notifyChatDeleted(room.getId(), Set.of(bannerId, targetUserId));
            log.info("Private chat {} frozen for users {} and {} after ban", room.getId(), bannerId, targetUserId);
        });
    }

    public void handleUserUnbanned(Long bannerId, Long targetUserId) {
        if (bannerId == null || targetUserId == null || bannerId.equals(targetUserId)) {
            return;
        }
        findPrivateChat(bannerId, targetUserId).ifPresent(room -> {
            int unreadForBanner = roomEnricher.getUnreadCount(room.getId(), bannerId);
            int unreadForTarget = roomEnricher.getUnreadCount(room.getId(), targetUserId);
            webSocketService.notifyChatCreated(bannerId,
                    roomEnricher.enrichChatWithUserData(room, bannerId, unreadForBanner));
            webSocketService.notifyChatCreated(targetUserId,
                    roomEnricher.enrichChatWithUserData(room, targetUserId, unreadForTarget));
            log.info("Private chat {} restored for users {} and {} after unban", room.getId(), bannerId, targetUserId);
        });
    }

    private Optional<ChatRoom> findPrivateChat(Long userId1, Long userId2) {
        return chatRoomRepository.findPrivateChatBetweenUsers(ChatType.PRIVATE, List.of(userId1, userId2));
    }
}
