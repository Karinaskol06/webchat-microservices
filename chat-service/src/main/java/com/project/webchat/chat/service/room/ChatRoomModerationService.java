package com.project.webchat.chat.service.room;

import com.project.webchat.chat.dto.AdminAction;
import com.project.webchat.chat.dto.AdminMutationRequest;
import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.exception.ForbiddenChatOperationException;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.support.ChatRoomEnricher;
import com.project.webchat.chat.service.support.ChatRoomUpdateNotifier;
import com.project.webchat.chat.service.support.ChatRoomMemberMutationHelper;
import com.project.webchat.chat.service.support.ChatRoomPermissionService;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import com.project.webchat.shared.dto.UserInfoDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Group/channel roles and room bans.
 */
@Service
@RequiredArgsConstructor
public class ChatRoomModerationService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatUserInfoService chatUserInfoService;
    private final ChatRoomEnricher roomEnricher;
    private final ChatRoomUpdateNotifier roomUpdateNotifier;
    private final ChatRoomPermissionService roomPermissionService;
    private final ChatRoomMemberMutationHelper memberMutationHelper;

    @Transactional
    public ChatRoomDTO mutateGroupAdmins(String roomId, Long actorId, AdminMutationRequest request) {
        ChatRoom room = memberMutationHelper.loadRoom(roomId);
        if (room.getType() != ChatType.GROUP && room.getType() != ChatType.CHANNEL) {
            throw new IllegalArgumentException("Admin actions apply only to group chats and channels");
        }
        if (!room.isMember(actorId)) {
            throw new ForbiddenChatOperationException("You are not a member of this chat");
        }
        Long target = request.getUserId();
        AdminAction action = request.getAction();

        if (room.getType() == ChatType.GROUP) {
            mutateGroupAdmin(room, actorId, target, action);
        } else {
            mutateChannelRole(room, actorId, target, action);
        }
        ChatRoom saved = chatRoomRepository.save(room);
        roomUpdateNotifier.notifyRoomMembersChatUpdated(saved);
        return roomEnricher.enrichChatWithUserData(
                saved, actorId, roomEnricher.getUnreadCount(saved.getId(), actorId));
    }

    @Transactional
    public ChatRoomDTO banRoomMember(String roomId, Long actorId, Long targetUserId) {
        if (targetUserId == null) {
            throw new IllegalArgumentException("User id is required");
        }
        ChatRoom room = memberMutationHelper.loadRoom(roomId);
        roomPermissionService.assertCanModerateMembers(room, actorId);
        if (roomPermissionService.sameUserId(targetUserId, room.getCreatedBy())) {
            throw new ForbiddenChatOperationException("You cannot ban the room owner");
        }
        if (roomPermissionService.sameUserId(targetUserId, actorId)) {
            throw new ForbiddenChatOperationException("You cannot ban yourself");
        }
        if (room.getBannedUserIds() == null) {
            room.setBannedUserIds(new HashSet<>());
        }
        room.getBannedUserIds().add(targetUserId);
        memberMutationHelper.cancelPendingInvite(roomId, targetUserId);
        if (room.isMember(targetUserId)) {
            memberMutationHelper.removeMemberFromRoom(room, targetUserId);
        } else {
            chatRoomRepository.save(room);
        }
        ChatRoom saved = chatRoomRepository.findById(roomId).orElse(room);
        roomUpdateNotifier.notifyRoomMembersChatUpdated(saved);
        return roomEnricher.enrichChatWithUserData(
                saved, actorId, roomEnricher.getUnreadCount(saved.getId(), actorId));
    }

    @Transactional
    public ChatRoomDTO unbanRoomMember(String roomId, Long actorId, Long targetUserId) {
        if (targetUserId == null) {
            throw new IllegalArgumentException("User id is required");
        }
        ChatRoom room = memberMutationHelper.loadRoom(roomId);
        roomPermissionService.assertCanModerateMembers(room, actorId);
        if (room.getBannedUserIds() == null || !room.getBannedUserIds().contains(targetUserId)) {
            throw new IllegalArgumentException("That user is not banned from this room");
        }
        room.getBannedUserIds().remove(targetUserId);
        ChatRoom saved = chatRoomRepository.save(room);
        roomUpdateNotifier.notifyRoomMembersChatUpdated(saved);
        return roomEnricher.enrichChatWithUserData(
                saved, actorId, roomEnricher.getUnreadCount(saved.getId(), actorId));
    }

    public List<UserInfoDTO> listBannedRoomMembers(String roomId, Long actorId) {
        ChatRoom room = memberMutationHelper.loadRoom(roomId);
        roomPermissionService.assertCanModerateMembers(room, actorId);
        if (room.getBannedUserIds() == null || room.getBannedUserIds().isEmpty()) {
            return List.of();
        }
        return room.getBannedUserIds().stream()
                .map(chatUserInfoService::getUserInfo)
                .toList();
    }

    private void mutateGroupAdmin(ChatRoom room, Long actorId, Long target, AdminAction action) {
        if (action != AdminAction.PROMOTE && action != AdminAction.DEMOTE) {
            throw new IllegalArgumentException("Unsupported admin action for groups");
        }
        if (!roomPermissionService.hasGroupAdminRights(room, actorId)) {
            throw new ForbiddenChatOperationException("Only admins can change admin roles");
        }
        if (!room.isMember(target)) {
            throw new IllegalArgumentException("That user is not a member of this group");
        }
        Set<Long> admins = new HashSet<>();
        if (room.getAdminIds() != null) {
            admins.addAll(room.getAdminIds());
        }
        if (action == AdminAction.PROMOTE) {
            admins.add(target);
        } else {
            if (!roomPermissionService.setContainsUserId(admins, target)) {
                throw new IllegalArgumentException("That user is not an admin");
            }
            Set<Long> after = new HashSet<>(admins);
            after.remove(target);
            if (after.isEmpty()) {
                throw new IllegalArgumentException("Cannot demote the last admin. Promote another member first.");
            }
            admins = after;
        }
        room.setAdminIds(admins);
    }

    private void mutateChannelRole(ChatRoom room, Long actorId, Long target, AdminAction action) {
        if (!roomPermissionService.hasChannelModeratorRights(room, actorId)) {
            throw new ForbiddenChatOperationException("Only channel owners and moderators can manage roles");
        }
        if (!room.isMember(target)) {
            throw new IllegalArgumentException("That user is not a member of this channel");
        }
        if (room.getCreatedBy() != null && roomPermissionService.sameUserId(room.getCreatedBy(), target)
                && (action == AdminAction.DEMOTE || action == AdminAction.REVOKE_POST)) {
            throw new IllegalArgumentException("Cannot change the channel owner's moderator role or posting rights");
        }
        switch (action) {
            case PROMOTE -> {
                if (room.getCreatedBy() != null && roomPermissionService.sameUserId(room.getCreatedBy(), target)) {
                    throw new IllegalArgumentException("The channel owner is already a moderator");
                }
                if (room.getAdminIds() == null) {
                    room.setAdminIds(new HashSet<>());
                }
                room.getAdminIds().add(target);
                if (room.getChannelPosterIds() != null) {
                    room.getChannelPosterIds().remove(target);
                }
            }
            case DEMOTE -> {
                if (!roomPermissionService.setContainsUserId(room.getAdminIds(), target)) {
                    throw new IllegalArgumentException("That user is not a channel moderator");
                }
                room.getAdminIds().remove(target);
            }
            case GRANT_POST -> {
                if (room.getCreatedBy() != null && roomPermissionService.sameUserId(room.getCreatedBy(), target)) {
                    throw new IllegalArgumentException("The channel owner can already post");
                }
                if (roomPermissionService.setContainsUserId(room.getAdminIds(), target)) {
                    throw new IllegalArgumentException("Channel moderators can already post");
                }
                if (room.getChannelPosterIds() == null) {
                    room.setChannelPosterIds(new HashSet<>());
                }
                room.getChannelPosterIds().add(target);
            }
            case REVOKE_POST -> {
                if (room.getChannelPosterIds() == null || !room.getChannelPosterIds().contains(target)) {
                    throw new IllegalArgumentException("That user does not have explicit posting permission");
                }
                room.getChannelPosterIds().remove(target);
            }
            default -> throw new IllegalArgumentException("Unsupported admin action");
        }
    }
}
