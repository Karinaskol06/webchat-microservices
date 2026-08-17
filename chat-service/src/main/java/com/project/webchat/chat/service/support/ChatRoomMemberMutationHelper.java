package com.project.webchat.chat.service.support;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.entity.RoomMemberInviteState;
import com.project.webchat.chat.exception.ForbiddenChatOperationException;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.repository.RoomMemberInviteRepository;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.WebSocketService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

/**
 * Shared load / add / remove / invite-assert helpers used by room use-case modules.
 * Keeps mutation side effects (Redis, WebSocket, enrichment) in one place.
 */
@Component
@RequiredArgsConstructor
public class ChatRoomMemberMutationHelper {

    private final ChatRoomRepository chatRoomRepository;
    private final RoomMemberInviteRepository roomMemberInviteRepository;
    private final RedisService redisService;
    private final WebSocketService webSocketService;
    private final ChatRoomEnrichmentService roomEnrichmentService;
    private final ChatRoomPermissionService roomPermissionService;

    public ChatRoom loadRoom(String roomId) {
        return chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));
    }

    public void cancelPendingInvite(String roomId, Long inviteeUserId) {
        roomMemberInviteRepository
                .findByRoomIdAndInviteeUserIdAndState(roomId, inviteeUserId, RoomMemberInviteState.PENDING)
                .ifPresent(invite -> {
                    invite.setState(RoomMemberInviteState.DECLINED);
                    invite.setRespondedAt(LocalDateTime.now());
                    roomMemberInviteRepository.save(invite);
                });
    }

    public void removeMemberFromRoom(ChatRoom room, Long userId) {
        String chatId = room.getId();
        Set<Long> otherMembers = new HashSet<>(room.getMemberIds());
        otherMembers.remove(userId);
        room.getMemberIds().remove(userId);
        if (room.getAdminIds() != null) {
            room.getAdminIds().remove(userId);
        }
        if (room.getChannelPosterIds() != null) {
            room.getChannelPosterIds().remove(userId);
        }
        chatRoomRepository.save(room);
        redisService.evictChatParticipants(chatId);
        if (!otherMembers.isEmpty()) {
            webSocketService.notifyUserLeftChatForAll(chatId, userId, otherMembers);
        }
        webSocketService.notifyChatDeleted(chatId, Set.of(userId));
        redisService.markUserOffline(userId);
        webSocketService.notifyUserLeftChat(chatId, userId);
    }

    public ChatRoom addMemberToRoom(ChatRoom room, Long newMemberId) {
        if (room.isMember(newMemberId)) {
            return room;
        }
        roomPermissionService.assertNotBanned(room, newMemberId);
        room.addMember(newMemberId);
        ChatRoom saved = chatRoomRepository.save(room);
        redisService.evictChatParticipants(saved.getId());
        roomEnrichmentService.notifyRoomMembersChatUpdated(saved);
        webSocketService.notifyChatCreated(newMemberId,
                roomEnrichmentService.enrichChatWithUserData(
                        saved, newMemberId, roomEnrichmentService.getUnreadCount(saved.getId(), newMemberId)));
        return saved;
    }

    public void assertCanInviteMembers(ChatRoom room, Long actorId) {
        if (room.getType() != ChatType.GROUP && room.getType() != ChatType.CHANNEL) {
            throw new IllegalArgumentException("Members can only be invited to groups or channels");
        }
        if (!room.isMember(actorId)) {
            throw new ForbiddenChatOperationException("You are not a member of this chat");
        }
        boolean canInvite = room.getType() == ChatType.GROUP
                ? roomPermissionService.hasGroupAdminRights(room, actorId)
                : roomPermissionService.hasChannelModeratorRights(room, actorId);
        if (!canInvite) {
            throw new ForbiddenChatOperationException("You cannot invite members to this room");
        }
    }

    public void assertCanManageInvite(ChatRoom room, Long userId) {
        if (room.getType() == ChatType.GROUP) {
            if (!roomPermissionService.hasGroupAdminRights(room, userId)) {
                throw new ForbiddenChatOperationException("Only group admins can manage the invite link");
            }
        } else if (room.getType() == ChatType.CHANNEL) {
            if (!roomPermissionService.hasChannelModeratorRights(room, userId)) {
                throw new ForbiddenChatOperationException(
                        "Only channel owners and moderators can manage the invite link");
            }
        } else {
            throw new IllegalArgumentException("This room does not support invite links");
        }
    }

    public String normalizeGroupPhoto(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.startsWith("data:image/")) {
            return trimmed;
        }
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            return trimmed;
        }
        throw new IllegalArgumentException("Room image must be an https URL or a pasted image (data URL).");
    }

    public String normalizeRoomDescription(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
