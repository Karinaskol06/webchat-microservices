package com.project.webchat.chat.service.room;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.repository.RoomMemberInviteRepository;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.support.ChatRoomUpdateNotifier;
import com.project.webchat.chat.service.support.RoomOwnerSuccessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserAccountDeletionService {

    private final ChatRoomRepository chatRoomRepository;
    private final RoomMemberInviteRepository roomMemberInviteRepository;
    private final RedisService redisService;
    private final ChatRoomUpdateNotifier roomUpdateNotifier;
    private final ChatRoomLifecycleService chatRoomLifecycleService;
    private final RoomOwnerSuccessionService roomOwnerSuccessionService;

    @Transactional
    public void handleAccountDeleted(Long userId) {
        if (userId == null) {
            return;
        }

        List<ChatRoom> rooms = new ArrayList<>(chatRoomRepository.findByMemberIdsContains(userId));
        Set<String> processed = new HashSet<>();

        for (ChatRoom room : rooms) {
            if (room.getId() == null || !processed.add(room.getId())) {
                continue;
            }
            handleRoomForDeletedAccount(room, userId);
        }

        for (ChatRoom room : chatRoomRepository.findByTypeAndCreatedByOrderByLastActivityDesc(
                ChatType.PERSONAL_SPACE, userId)) {
            if (room.getId() != null && processed.add(room.getId())) {
                chatRoomLifecycleService.purgeRoom(room);
            }
        }

        roomMemberInviteRepository.deleteByInviteeUserId(userId);

        redisService.evictUserInfo(userId);
        redisService.markUserOffline(userId);
        log.info("Completed chat cleanup for deleted account {}", userId);
    }

    private void handleRoomForDeletedAccount(ChatRoom room, Long userId) {
        ChatType type = room.getType() == null ? ChatType.PRIVATE : room.getType();

        if (type == ChatType.PERSONAL_SPACE) {
            if (userId.equals(room.getCreatedBy())) {
                chatRoomLifecycleService.purgeRoom(room);
            }
            return;
        }

        if (type == ChatType.PRIVATE) {
            roomUpdateNotifier.notifyRoomMembersChatUpdated(room);
            return;
        }

        if (type == ChatType.GROUP || type == ChatType.CHANNEL) {
            if (userId.equals(room.getCreatedBy())) {
                Long successor = roomOwnerSuccessionService.pickOwnerSuccessor(room, userId);
                if (successor == null) {
                    chatRoomLifecycleService.purgeRoom(room);
                    return;
                }
                roomOwnerSuccessionService.transferOwnership(room, successor);
            }

            removeDepartingMember(room, userId);
            if (room.getMemberIds() == null || room.getMemberIds().isEmpty()) {
                chatRoomLifecycleService.purgeRoom(room);
                return;
            }

            ChatRoom saved = chatRoomRepository.save(room);
            redisService.evictChatParticipants(saved.getId());
            roomUpdateNotifier.notifyRoomMembersChatUpdated(saved);
        }
    }

    private void removeDepartingMember(ChatRoom room, Long userId) {
        if (room.getMemberIds() != null) {
            room.getMemberIds().removeIf(id -> id != null && id.longValue() == userId.longValue());
        }
        if (room.getAdminIds() != null) {
            room.getAdminIds().removeIf(id -> id != null && id.longValue() == userId.longValue());
        }
        if (room.getChannelPosterIds() != null) {
            room.getChannelPosterIds().removeIf(id -> id != null && id.longValue() == userId.longValue());
        }
        if (room.getBannedUserIds() != null) {
            room.getBannedUserIds().removeIf(id -> id != null && id.longValue() == userId.longValue());
        }
    }
}
