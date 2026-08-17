package com.project.webchat.chat.service.room;

import com.project.webchat.chat.dto.*;
import com.project.webchat.chat.entity.*;
import com.project.webchat.chat.exception.ForbiddenChatOperationException;
import com.project.webchat.chat.feign.UserServiceClient;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.repository.RoomMemberInviteRepository;
import com.project.webchat.chat.service.ChatNotificationEventPublisher;
import com.project.webchat.chat.service.WebSocketService;
import com.project.webchat.chat.service.support.ChatRoomEnrichmentService;
import com.project.webchat.chat.service.support.ChatRoomMemberMutationHelper;
import com.project.webchat.chat.service.support.ChatRoomPermissionService;
import com.project.webchat.chat.service.support.UserBanGuardService;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.shared.dto.UserInfoDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Invite links, member invites, admins, bans, and room profile.
 * Final slice of the former ChatRoomManagementService god object.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatRoomMembershipService {

    private final ChatRoomRepository chatRoomRepository;
    private final RoomMemberInviteRepository roomMemberInviteRepository;
    private final UserServiceClient userServiceClient;
    private final WebSocketService webSocketService;
    private final ChatUserInfoService chatUserInfoService;
    private final ChatRoomEnrichmentService roomEnrichmentService;
    private final ChatRoomPermissionService roomPermissionService;
    private final ChatNotificationEventPublisher chatNotificationEventPublisher;
    private final UserBanGuardService userBanGuardService;
    private final ChatRoomMemberMutationHelper memberMutationHelper;

    @Transactional
    public InvitePayloadDTO regenerateInvite(String roomId, Long userId) {
        ChatRoom room = memberMutationHelper.loadRoom(roomId);
        if (!room.isMember(userId)) {
            throw new ForbiddenChatOperationException("You must be a member to regenerate this invite");
        }
        RoomVisibility vis = room.getVisibility() != null ? room.getVisibility() : RoomVisibility.PRIVATE;
        if (vis != RoomVisibility.PRIVATE) {
            throw new IllegalArgumentException("Invite links are only available for private rooms");
        }
        memberMutationHelper.assertCanManageInvite(room, userId);
        String newToken = UUID.randomUUID().toString();
        room.setInviteToken(newToken);
        ChatRoom saved = chatRoomRepository.save(room);
        roomEnrichmentService.notifyRoomMembersChatUpdated(saved);
        return new InvitePayloadDTO(newToken);
    }

    public InvitePayloadDTO getInvitePayload(String roomId, Long userId) {
        ChatRoom room = memberMutationHelper.loadRoom(roomId);
        if (!room.isMember(userId)) {
            throw new ForbiddenChatOperationException("You are not a member of this chat");
        }
        RoomVisibility vis = room.getVisibility() != null ? room.getVisibility() : RoomVisibility.PRIVATE;
        if (vis != RoomVisibility.PRIVATE) {
            throw new IllegalArgumentException("This room has no invite link");
        }
        memberMutationHelper.assertCanManageInvite(room, userId);
        if (room.getInviteToken() == null || room.getInviteToken().isBlank()) {
            throw new IllegalArgumentException("This room has no invite link");
        }
        return new InvitePayloadDTO(room.getInviteToken());
    }

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
        roomEnrichmentService.notifyRoomMembersChatUpdated(saved);
        return roomEnrichmentService.enrichChatWithUserData(
                saved, actorId, roomEnrichmentService.getUnreadCount(saved.getId(), actorId));
    }

    @Transactional
    public ChatRoomDTO addRoomMember(String roomId, Long actorId, Long newMemberId) {
        if (newMemberId == null) {
            throw new IllegalArgumentException("User id is required");
        }
        ChatRoom room = memberMutationHelper.loadRoom(roomId);
        memberMutationHelper.assertCanInviteMembers(room, actorId);
        userBanGuardService.assertCanInviteUser(actorId, newMemberId);
        roomPermissionService.assertNotBanned(room, newMemberId);
        if (room.isMember(newMemberId)) {
            return roomEnrichmentService.enrichChatWithUserData(
                    room, actorId, roomEnrichmentService.getUnreadCount(room.getId(), actorId));
        }
        ChatRoom saved = memberMutationHelper.addMemberToRoom(room, newMemberId);
        return roomEnrichmentService.enrichChatWithUserData(
                saved, actorId, roomEnrichmentService.getUnreadCount(saved.getId(), actorId));
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
        roomEnrichmentService.notifyRoomMembersChatUpdated(saved);
        return roomEnrichmentService.enrichChatWithUserData(
                saved, actorId, roomEnrichmentService.getUnreadCount(saved.getId(), actorId));
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
        roomEnrichmentService.notifyRoomMembersChatUpdated(saved);
        return roomEnrichmentService.enrichChatWithUserData(
                saved, actorId, roomEnrichmentService.getUnreadCount(saved.getId(), actorId));
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

    @Transactional
    public ChatRoomDTO updateRoomPhoto(String roomId, Long actorId, String groupPhotoRaw) {
        UpdateRoomProfileRequest request = new UpdateRoomProfileRequest();
        request.setGroupPhoto(groupPhotoRaw);
        return updateRoomProfile(roomId, actorId, request);
    }

    @Transactional
    public ChatRoomDTO updateRoomProfile(String roomId, Long actorId, UpdateRoomProfileRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("Update payload is required");
        }
        boolean hasName = request.getGroupName() != null;
        boolean hasDescription = request.getDescription() != null;
        boolean hasPhoto = request.getGroupPhoto() != null;
        boolean hasVisibility = request.getVisibility() != null;
        if (!hasName && !hasDescription && !hasPhoto && !hasVisibility) {
            throw new IllegalArgumentException("At least one field must be provided to update");
        }

        ChatRoom room = memberMutationHelper.loadRoom(roomId);
        if (hasName || hasDescription || hasPhoto) {
            roomPermissionService.assertCanManageRoomProfile(room, actorId);
        }
        if (hasVisibility) {
            roomPermissionService.assertCanChangeRoomVisibility(room, actorId);
        }

        if (hasName) {
            String name = request.getGroupName().trim();
            if (name.isEmpty()) {
                throw new IllegalArgumentException("Name is required");
            }
            room.setGroupName(name);
        }
        if (hasDescription) {
            room.setDescription(memberMutationHelper.normalizeRoomDescription(request.getDescription()));
        }
        if (hasPhoto) {
            room.setGroupPhoto(memberMutationHelper.normalizeGroupPhoto(request.getGroupPhoto()));
        }
        if (hasVisibility) {
            RoomVisibility newVisibility = request.getVisibility();
            RoomVisibility current = room.getVisibility() != null ? room.getVisibility() : RoomVisibility.PRIVATE;
            if (newVisibility != current) {
                room.setVisibility(newVisibility);
                if (newVisibility == RoomVisibility.PRIVATE) {
                    room.setInviteToken(UUID.randomUUID().toString());
                } else {
                    room.setInviteToken(null);
                }
            }
        }

        ChatRoom saved = chatRoomRepository.save(room);
        roomEnrichmentService.notifyRoomMembersChatUpdated(saved);
        return roomEnrichmentService.enrichChatWithUserData(
                saved, actorId, roomEnrichmentService.getUnreadCount(saved.getId(), actorId));
    }

    public List<RoomMemberInviteDTO> listPendingRoomMemberInvites(Long inviteeUserId) {
        return roomMemberInviteRepository
                .findByInviteeUserIdAndStateOrderByCreatedAtDesc(inviteeUserId, RoomMemberInviteState.PENDING)
                .stream()
                .map(this::toRoomMemberInviteDto)
                .toList();
    }

    @Transactional
    public RoomMemberInviteDTO inviteRoomMemberByUsername(String roomId, Long actorId, String rawUsername) {
        String username = normalizeUsername(rawUsername);
        if (username.isEmpty()) {
            throw new IllegalArgumentException("Username is required");
        }
        ChatRoom room = memberMutationHelper.loadRoom(roomId);
        memberMutationHelper.assertCanInviteMembers(room, actorId);

        Long inviteeId = resolveUserIdByUsername(username);
        if (inviteeId.equals(actorId)) {
            throw new IllegalArgumentException("You cannot invite yourself");
        }
        if (room.isMember(inviteeId)) {
            throw new IllegalArgumentException("That user is already a member");
        }
        userBanGuardService.assertCanInviteUser(actorId, inviteeId);
        roomPermissionService.assertNotBanned(room, inviteeId);
        roomMemberInviteRepository
                .findByRoomIdAndInviteeUserIdAndState(roomId, inviteeId, RoomMemberInviteState.PENDING)
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("An invite is already pending for that user");
                });

        RoomMemberInvite invite = RoomMemberInvite.builder()
                .roomId(roomId)
                .roomName(room.getGroupName())
                .roomType(room.getType())
                .invitedByUserId(actorId)
                .inviteeUserId(inviteeId)
                .state(RoomMemberInviteState.PENDING)
                .createdAt(LocalDateTime.now())
                .build();
        RoomMemberInvite saved = roomMemberInviteRepository.save(invite);
        RoomMemberInviteDTO dto = toRoomMemberInviteDto(saved);
        webSocketService.notifyRoomMemberInvite(inviteeId, dto);
        chatNotificationEventPublisher.publishRoomMemberInvited(saved);
        return dto;
    }

    @Transactional
    public ChatRoomDTO acceptRoomMemberInvite(String inviteId, Long inviteeId) {
        RoomMemberInvite invite = roomMemberInviteRepository.findById(inviteId)
                .orElseThrow(() -> new IllegalArgumentException("Invite not found"));
        if (!inviteeId.equals(invite.getInviteeUserId())) {
            throw new ForbiddenChatOperationException("You cannot accept this invite");
        }
        if (invite.getState() != RoomMemberInviteState.PENDING) {
            throw new IllegalArgumentException("Invite is no longer pending");
        }
        ChatRoom room = memberMutationHelper.loadRoom(invite.getRoomId());
        roomPermissionService.assertNotBanned(room, inviteeId);
        ChatRoom saved = memberMutationHelper.addMemberToRoom(room, inviteeId);
        invite.setState(RoomMemberInviteState.ACCEPTED);
        invite.setRespondedAt(LocalDateTime.now());
        roomMemberInviteRepository.save(invite);
        return roomEnrichmentService.enrichChatWithUserData(
                saved, inviteeId, roomEnrichmentService.getUnreadCount(saved.getId(), inviteeId));
    }

    @Transactional
    public void declineRoomMemberInvite(String inviteId, Long inviteeId) {
        RoomMemberInvite invite = roomMemberInviteRepository.findById(inviteId)
                .orElseThrow(() -> new IllegalArgumentException("Invite not found"));
        if (!inviteeId.equals(invite.getInviteeUserId())) {
            throw new ForbiddenChatOperationException("You cannot decline this invite");
        }
        if (invite.getState() != RoomMemberInviteState.PENDING) {
            throw new IllegalArgumentException("Invite is no longer pending");
        }
        invite.setState(RoomMemberInviteState.DECLINED);
        invite.setRespondedAt(LocalDateTime.now());
        roomMemberInviteRepository.save(invite);
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

    private Long resolveUserIdByUsername(String username) {
        try {
            ResponseEntity<UserDTO> response = userServiceClient.getUserByUsername(username);
            UserDTO user = response.getBody();
            if (user == null || user.getId() == null) {
                throw new IllegalArgumentException("User not found");
            }
            return user.getId();
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Failed to resolve username {}: {}", username, e.getMessage());
            throw new IllegalArgumentException("User not found");
        }
    }

    private String normalizeUsername(String raw) {
        if (raw == null) {
            return "";
        }
        String trimmed = raw.trim();
        if (trimmed.startsWith("@")) {
            trimmed = trimmed.substring(1).trim();
        }
        return trimmed;
    }

    private RoomMemberInviteDTO toRoomMemberInviteDto(RoomMemberInvite invite) {
        return RoomMemberInviteDTO.builder()
                .id(invite.getId())
                .roomId(invite.getRoomId())
                .roomName(invite.getRoomName())
                .roomType(invite.getRoomType() != null ? invite.getRoomType().name() : null)
                .invitedByUserId(invite.getInvitedByUserId())
                .invitedBy(chatUserInfoService.getUserInfo(invite.getInvitedByUserId()))
                .state(invite.getState() != null ? invite.getState().name() : null)
                .createdAt(invite.getCreatedAt())
                .build();
    }
}
