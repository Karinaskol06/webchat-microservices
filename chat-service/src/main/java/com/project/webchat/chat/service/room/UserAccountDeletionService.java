package com.project.webchat.chat.service.room;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.repository.RoomMemberInviteRepository;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.support.ChatRoomEnrichmentService;
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
    private final ChatRoomEnrichmentService roomEnrichmentService;
    private final ChatRoomManagementService chatRoomManagementService;

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
                chatRoomManagementService.purgeRoom(room);
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
                chatRoomManagementService.purgeRoom(room);
            }
            return;
        }

        if (type == ChatType.PRIVATE) {
            roomEnrichmentService.notifyRoomMembersChatUpdated(room);
            return;
        }

        if (type == ChatType.GROUP || type == ChatType.CHANNEL) {
            if (userId.equals(room.getCreatedBy())) {
                Long successor = pickOwnerSuccessor(room, userId);
                if (successor == null) {
                    chatRoomManagementService.purgeRoom(room);
                    return;
                }
                room.setCreatedBy(successor);
                if (room.getAdminIds() == null) {
                    room.setAdminIds(new HashSet<>());
                }
                room.getAdminIds().add(successor);
            }

            removeDepartingMember(room, userId);
            if (room.getMemberIds() == null || room.getMemberIds().isEmpty()) {
                chatRoomManagementService.purgeRoom(room);
                return;
            }

            ChatRoom saved = chatRoomRepository.save(room);
            redisService.evictChatParticipants(saved.getId());
            roomEnrichmentService.notifyRoomMembersChatUpdated(saved);
        }
    }

    private Long pickOwnerSuccessor(ChatRoom room, Long departingOwnerId) {
        if (room.getAdminIds() != null) {
            for (Long adminId : room.getAdminIds()) {
                if (adminId != null
                        && adminId.longValue() != departingOwnerId.longValue()
                        && room.isMember(adminId)) {
                    return adminId;
                }
            }
        }
        if (room.getMemberIds() == null) {
            return null;
        }
        for (Long memberId : room.getMemberIds()) {
            if (memberId != null && memberId.longValue() != departingOwnerId.longValue()) {
                return memberId;
            }
        }
        return null;
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
