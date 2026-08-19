package com.project.webchat.chat.service.room;

import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.dto.InvitePayloadDTO;
import com.project.webchat.chat.dto.RoomMemberInviteDTO;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.RoomMemberInvite;
import com.project.webchat.chat.entity.RoomMemberInviteState;
import com.project.webchat.chat.entity.RoomVisibility;
import com.project.webchat.chat.exception.ForbiddenChatOperationException;
import com.project.webchat.chat.feign.UserServiceClient;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.repository.RoomMemberInviteRepository;
import com.project.webchat.chat.service.ChatNotificationEventPublisher;
import com.project.webchat.chat.service.WebSocketService;
import com.project.webchat.chat.service.support.ChatRoomEnricher;
import com.project.webchat.chat.service.support.ChatRoomUpdateNotifier;
import com.project.webchat.chat.service.support.ChatRoomMemberMutationHelper;
import com.project.webchat.chat.service.support.ChatRoomPermissionService;
import com.project.webchat.chat.service.support.UserBanGuardService;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import com.project.webchat.shared.dto.UserDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Invite links, username invites, and direct add.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatRoomInviteService {

    private final ChatRoomRepository chatRoomRepository;
    private final RoomMemberInviteRepository roomMemberInviteRepository;
    private final UserServiceClient userServiceClient;
    private final WebSocketService webSocketService;
    private final ChatUserInfoService chatUserInfoService;
    private final ChatRoomEnricher roomEnricher;
    private final ChatRoomUpdateNotifier roomUpdateNotifier;
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
        roomUpdateNotifier.notifyRoomMembersChatUpdated(saved);
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
    public ChatRoomDTO addRoomMember(String roomId, Long actorId, Long newMemberId) {
        if (newMemberId == null) {
            throw new IllegalArgumentException("User id is required");
        }
        ChatRoom room = memberMutationHelper.loadRoom(roomId);
        memberMutationHelper.assertCanInviteMembers(room, actorId);
        userBanGuardService.assertCanInviteUser(actorId, newMemberId);
        roomPermissionService.assertNotBanned(room, newMemberId);
        if (room.isMember(newMemberId)) {
            return roomEnricher.enrichChatWithUserData(
                    room, actorId, roomEnricher.getUnreadCount(room.getId(), actorId));
        }
        ChatRoom saved = memberMutationHelper.addMemberToRoom(room, newMemberId);
        return roomEnricher.enrichChatWithUserData(
                saved, actorId, roomEnricher.getUnreadCount(saved.getId(), actorId));
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
        return roomEnricher.enrichChatWithUserData(
                saved, inviteeId, roomEnricher.getUnreadCount(saved.getId(), inviteeId));
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
