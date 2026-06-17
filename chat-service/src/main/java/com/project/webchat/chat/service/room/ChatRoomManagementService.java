package com.project.webchat.chat.service.room;

import com.project.webchat.chat.dto.*;
import com.project.webchat.chat.entity.*;
import com.project.webchat.chat.exception.ForbiddenChatOperationException;
import com.project.webchat.chat.exception.RoomBanException;
import com.project.webchat.chat.feign.UserServiceClient;
import com.project.webchat.chat.repository.AttachmentRepository;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.repository.RoomMemberInviteRepository;
import com.project.webchat.chat.service.ChatNotificationEventPublisher;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.WebSocketService;
import com.project.webchat.chat.service.support.ChatRoomEnrichmentService;
import com.project.webchat.chat.service.support.ChatRoomPermissionService;
import com.project.webchat.chat.service.support.UserBanGuardService;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.shared.dto.UserInfoDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatRoomManagementService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final AttachmentRepository attachmentRepository;
    private final RoomMemberInviteRepository roomMemberInviteRepository;
    private final UserServiceClient userServiceClient;
    private final RedisService redisService;
    private final WebSocketService webSocketService;
    private final ChatUserInfoService chatUserInfoService;
    private final ChatRoomEnrichmentService roomEnrichmentService;
    private final ChatRoomPermissionService roomPermissionService;
    private final ChatNotificationEventPublisher chatNotificationEventPublisher;
    private final PersonalSpaceService personalSpaceService;
    private final UserBanGuardService userBanGuardService;

    public Page<ChatRoomDTO> getAllUserChatsSorted(Long userId, Pageable pageable) {
        Page<ChatRoom> chatPage = chatRoomRepository
                .findByMemberIdsContainsOrderByLastActivityDesc(userId, pageable);

        var bannedUserIds = userBanGuardService.getBannedUserIds(userId);
        var banningUserIds = userBanGuardService.getBanningUserIds(userId);

        List<ChatRoomDTO> chatRooms = chatPage.getContent()
                .stream()
                .filter(chat -> chat.getType() != ChatType.PERSONAL_SPACE)
                .filter(chat -> !userBanGuardService.isPrivateChatHiddenForViewer(
                        chat, userId, bannedUserIds, banningUserIds))
                .map(chat -> roomEnrichmentService.enrichChatWithUserData(
                        chat, userId, roomEnrichmentService.getUnreadCount(chat.getId(), userId), true))
                .toList();

        return new PageImpl<>(chatRooms, pageable, chatPage.getTotalElements());
    }

    @Transactional
    public void leaveChat(String chatId, Long userId) {
        ChatRoom chat = chatRoomRepository.findById(chatId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));

        if (!chat.getMemberIds().contains(userId)) {
            throw new IllegalArgumentException("User is not a member of this chat");
        }

        // remove user from chat
        Set<Long> otherMembers = new HashSet<>(chat.getMemberIds());
        otherMembers.remove(userId);
        // remove user from chat members
        chat.getMemberIds().remove(userId);
        // remove user from chat admins
        if (chat.getAdminIds() != null) {
            chat.getAdminIds().remove(userId);
        }
        // remove user from chat channel posters
        if (chat.getChannelPosterIds() != null) {
            chat.getChannelPosterIds().remove(userId);
        }

        // if chat has no members, delete chat
        if (chat.getMemberIds().isEmpty()) {
            chatRoomRepository.delete(chat);
            redisService.evictChatParticipants(chatId);
            webSocketService.notifyChatDeleted(chatId, otherMembers);
        } else {
            // save chat
            chatRoomRepository.save(chat);
            // evict cached chat participants
            redisService.evictChatParticipants(chatId);
            webSocketService.notifyUserLeftChatForAll(chatId, userId, otherMembers);
            roomEnrichmentService.notifyRoomMembersChatUpdated(chat);
        }

        redisService.markUserOffline(userId);
        webSocketService.notifyUserLeftChat(chatId, userId);
    }

    @Transactional
    public void deleteRoom(String roomId, Long userId) {
        ChatRoom room = loadRoom(roomId);
        
        if (!room.isMember(userId)) {
            throw new ForbiddenChatOperationException("You are not a member of this chat");
        }

        if (room.getType() == ChatType.PERSONAL_SPACE) {
            if (room.getCreatedBy() == null || !room.getCreatedBy().equals(userId)) {
                throw new ForbiddenChatOperationException("Only the owner can delete this personal space");
            }
            if (personalSpaceService.countPersonalSpacesForUser(userId) <= 1) {
                throw new IllegalArgumentException("You must keep at least one personal space");
            }
        } else {
            // check if user has permission to delete chat
            boolean canDelete = room.getType() == ChatType.GROUP
                    ? roomPermissionService.hasGroupAdminRights(room, userId)
                    : roomPermissionService.hasChannelModeratorRights(room, userId);
            if (!canDelete) {
                throw new ForbiddenChatOperationException("Only the creator or admins can delete this room");
            }
        }

        // delete attachments, messages, invites and chat
        Set<Long> members = new HashSet<>(room.getMemberIds());
        attachmentRepository.deleteByChatId(roomId);
        chatMessageRepository.deleteByChatId(roomId);
        roomMemberInviteRepository.deleteByRoomId(roomId);
        // delete chat
        chatRoomRepository.delete(room);
        // evict cached chat participants
        redisService.evictChatParticipants(roomId);
        // notify users that chat was deleted
        webSocketService.notifyChatDeleted(roomId, members);
        log.info("Room {} deleted by user {}", roomId, userId);
    }

    @Transactional
    public ChatRoomDTO createGroupRoom(Long creatorId, CreateGroupChannelRequest request) {
        return createGroupOrChannelRoom(creatorId, request, ChatType.GROUP);
    }

    @Transactional
    public ChatRoomDTO createChannelRoom(Long creatorId, CreateGroupChannelRequest request) {
        return createGroupOrChannelRoom(creatorId, request, ChatType.CHANNEL);
    }

    // discover public rooms by query and current user id
    public Page<DiscoverableRoomDTO> discoverPublicRooms(Long currentUserId, String q, Pageable pageable) {
        String regex = (q == null || q.trim().isEmpty()) ? ".*" : Pattern.quote(q.trim());
        Page<ChatRoom> page = chatRoomRepository.findPublicDiscoverableRooms(
                ChatType.GROUP,
                ChatType.CHANNEL,
                RoomVisibility.PUBLIC,
                regex,
                currentUserId,
                pageable);
        List<DiscoverableRoomDTO> filtered = page.getContent().stream()
                .filter(room -> !room.isBanned(currentUserId))
                .map(DiscoverableRoomDTO::fromRoom)
                .toList();
        return new PageImpl<>(filtered, pageable, page.getTotalElements());
    }

    public Page<DiscoverableRoomDTO> searchMyGroupChannels(Long currentUserId, String q, Pageable pageable) {
        String regex = (q == null || q.trim().isEmpty()) ? ".*" : Pattern.quote(q.trim());
        return chatRoomRepository
                .findMemberGroupChannelsByName(currentUserId, ChatType.GROUP, ChatType.CHANNEL, regex, pageable)
                .map(room -> DiscoverableRoomDTO.fromRoom(room, true));
    }

    public ChatRoomDTO getRoomForMember(String roomId, Long userId) {
        ChatRoom room = loadRoom(roomId);
        roomPermissionService.assertNotBanned(room, userId);
        if (!room.isMember(userId)) {
            throw new ForbiddenChatOperationException("You are not a member of this chat");
        }
        if (room.getType() == ChatType.PRIVATE) {
            Long otherId = userBanGuardService.getOtherPrivateChatMemberId(room, userId);
            UserInfoDTO otherUser = otherId != null ? chatUserInfoService.getUserInfo(otherId) : null;
            userBanGuardService.assertPrivateChatAccessible(room, userId, otherUser);
        }
        return roomEnrichmentService.enrichChatWithUserData(
                room, userId, roomEnrichmentService.getUnreadCount(room.getId(), userId));
    }

    public List<UserInfoDTO> getRoomParticipantsForMember(String roomId, Long userId) {
        // check if cached participants exist
        List<Long> cachedParticipantIds = redisService.getCachedChatParticipants(roomId);
        // if cached participants exist and user is in them, return cached participants
        if (!cachedParticipantIds.isEmpty() && cachedParticipantIds.contains(userId)) {
            return cachedParticipantIds.stream()
                    .map(chatUserInfoService::getUserInfo)
                    .toList();
        }

        // if cached participants do not exist, load room and cache participants
        ChatRoom room = loadRoom(roomId);
        if (!room.isMember(userId)) {
            throw new ForbiddenChatOperationException("You are not a member of this chat");
        }

        redisService.cacheChatParticipants(roomId, room.getMemberIds());
        return room.getMemberIds().stream()
                .map(chatUserInfoService::getUserInfo)
                .toList();
    }

    @Transactional
    public ChatRoomDTO joinPublicRoom(String roomId, Long userId) {
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));
        if (room.getType() != ChatType.GROUP && room.getType() != ChatType.CHANNEL) {
            throw new IllegalArgumentException("This chat cannot be joined from discovery");
        }
        RoomVisibility vis = room.getVisibility() != null ? room.getVisibility() : RoomVisibility.PRIVATE;
        if (vis != RoomVisibility.PUBLIC) {
            throw new IllegalArgumentException("This room is not public");
        }
        if (room.isMember(userId)) {
            return roomEnrichmentService.enrichChatWithUserData(
                    room, userId, roomEnrichmentService.getUnreadCount(room.getId(), userId));
        }
        roomPermissionService.assertNotBanned(room, userId);
        room.addMember(userId);
        ChatRoom saved = chatRoomRepository.save(room);
        redisService.evictChatParticipants(roomId);
        roomEnrichmentService.notifyRoomMembersChatUpdated(saved);
        return roomEnrichmentService.enrichChatWithUserData(
                saved, userId, roomEnrichmentService.getUnreadCount(saved.getId(), userId));
    }

    @Transactional
    public ChatRoomDTO joinByInvite(Long userId, String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException("Invite token is required");
        }
        String token = rawToken.trim();
        // find room by invite token
        ChatRoom room = chatRoomRepository.findByInviteToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired invite"));
        // check if room is a group or channel
        if (room.getType() != ChatType.GROUP && room.getType() != ChatType.CHANNEL) {
            throw new IllegalArgumentException("Invalid invite");
        }
        // check if room is private
        RoomVisibility vis = room.getVisibility() != null ? room.getVisibility() : RoomVisibility.PRIVATE;
        if (vis != RoomVisibility.PRIVATE) {
            throw new IllegalArgumentException("This invite is not valid for this room");
        }
        // check if user is already a member of the room
        if (room.isMember(userId)) {
            return roomEnrichmentService.enrichChatWithUserData(
                    room, userId, roomEnrichmentService.getUnreadCount(room.getId(), userId));
        }
        roomPermissionService.assertNotBanned(room, userId);
        room.addMember(userId);
        ChatRoom saved = chatRoomRepository.save(room);
        // evict cached chat participants
        redisService.evictChatParticipants(saved.getId());
        roomEnrichmentService.notifyRoomMembersChatUpdated(saved);
        return roomEnrichmentService.enrichChatWithUserData(
                saved, userId, roomEnrichmentService.getUnreadCount(saved.getId(), userId));
    }

    @Transactional
    public InvitePayloadDTO regenerateInvite(String roomId, Long userId) {
        ChatRoom room = loadRoom(roomId);
        if (!room.isMember(userId)) {
            throw new ForbiddenChatOperationException("You must be a member to regenerate this invite");
        }
        RoomVisibility vis = room.getVisibility() != null ? room.getVisibility() : RoomVisibility.PRIVATE;
        if (vis != RoomVisibility.PRIVATE) {
            throw new IllegalArgumentException("Invite links are only available for private rooms");
        }
        assertCanManageInvite(room, userId);
        String newToken = UUID.randomUUID().toString();
        room.setInviteToken(newToken);
        ChatRoom saved = chatRoomRepository.save(room);
        roomEnrichmentService.notifyRoomMembersChatUpdated(saved);
        return new InvitePayloadDTO(newToken);
    }

    public InvitePayloadDTO getInvitePayload(String roomId, Long userId) {
        ChatRoom room = loadRoom(roomId);
        if (!room.isMember(userId)) {
            throw new ForbiddenChatOperationException("You are not a member of this chat");
        }
        RoomVisibility vis = room.getVisibility() != null ? room.getVisibility() : RoomVisibility.PRIVATE;
        if (vis != RoomVisibility.PRIVATE) {
            throw new IllegalArgumentException("This room has no invite link");
        }
        assertCanManageInvite(room, userId);
        if (room.getInviteToken() == null || room.getInviteToken().isBlank()) {
            throw new IllegalArgumentException("This room has no invite link");
        }
        return new InvitePayloadDTO(room.getInviteToken());
    }

    @Transactional
    public ChatRoomDTO mutateGroupAdmins(String roomId, Long actorId, AdminMutationRequest request) {
        ChatRoom room = loadRoom(roomId);
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
        ChatRoom room = loadRoom(roomId);
        assertCanInviteMembers(room, actorId);
        userBanGuardService.assertCanInviteUser(actorId, newMemberId);
        roomPermissionService.assertNotBanned(room, newMemberId);
        if (room.isMember(newMemberId)) {
            return roomEnrichmentService.enrichChatWithUserData(
                    room, actorId, roomEnrichmentService.getUnreadCount(room.getId(), actorId));
        }
        ChatRoom saved = addMemberToRoom(room, newMemberId);
        return roomEnrichmentService.enrichChatWithUserData(
                saved, actorId, roomEnrichmentService.getUnreadCount(saved.getId(), actorId));
    }

    @Transactional
    public ChatRoomDTO banRoomMember(String roomId, Long actorId, Long targetUserId) {
        if (targetUserId == null) {
            throw new IllegalArgumentException("User id is required");
        }
        ChatRoom room = loadRoom(roomId);
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
        cancelPendingInvite(roomId, targetUserId);
        if (room.isMember(targetUserId)) {
            removeMemberFromRoom(room, targetUserId);
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
        ChatRoom room = loadRoom(roomId);
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
        ChatRoom room = loadRoom(roomId);
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
        if (!hasName && !hasDescription && !hasPhoto) {
            throw new IllegalArgumentException("At least one field must be provided to update");
        }

        ChatRoom room = loadRoom(roomId);
        roomPermissionService.assertCanManageRoomProfile(room, actorId);

        if (hasName) {
            String name = request.getGroupName().trim();
            if (name.isEmpty()) {
                throw new IllegalArgumentException("Name is required");
            }
            room.setGroupName(name);
        }
        if (hasDescription) {
            room.setDescription(normalizeRoomDescription(request.getDescription()));
        }
        if (hasPhoto) {
            room.setGroupPhoto(normalizeGroupPhoto(request.getGroupPhoto()));
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
        ChatRoom room = loadRoom(roomId);
        assertCanInviteMembers(room, actorId);

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
        ChatRoom room = loadRoom(invite.getRoomId());
        roomPermissionService.assertNotBanned(room, inviteeId);
        ChatRoom saved = addMemberToRoom(room, inviteeId);
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

    private ChatRoomDTO createGroupOrChannelRoom(Long creatorId, CreateGroupChannelRequest request, ChatType type) {
        if (type != ChatType.GROUP && type != ChatType.CHANNEL) {
            throw new IllegalArgumentException("Invalid room type");
        }
        String name = request.getName().trim();
        if (name.isEmpty()) {
            throw new IllegalArgumentException("Name is required");
        }
        Set<Long> members = new HashSet<>();
        if (request.getMemberIds() != null) {
            for (Long memberId : request.getMemberIds()) {
                if (memberId != null && !memberId.equals(creatorId)) {
                    userBanGuardService.assertCanInviteUser(creatorId, memberId);
                }
            }
            members.addAll(request.getMemberIds());
        }
        members.remove(null);
        members.add(creatorId);

        RoomVisibility visibility = request.getVisibility();
        // generate invite token for private rooms
        String inviteToken = visibility == RoomVisibility.PRIVATE ? UUID.randomUUID().toString() : null;
        // set admin ids for group rooms
        Set<Long> adminIds = type == ChatType.GROUP ? new HashSet<>(Set.of(creatorId)) : new HashSet<>();
        String groupPhoto = normalizeGroupPhoto(request.getGroupPhoto());
        String description = normalizeRoomDescription(request.getDescription());

        ChatRoom room = ChatRoom.builder()
                .type(type)
                .visibility(visibility)
                .memberIds(members)
                .groupName(name)
                .groupPhoto(groupPhoto)
                .description(description)
                .createdBy(creatorId)
                .adminIds(adminIds)
                .channelPosterIds(new HashSet<>())
                .bannedUserIds(new HashSet<>())
                .inviteToken(inviteToken)
                .lastActivity(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .lastMessage("Chat was created!")
                .build();

        ChatRoom saved = chatRoomRepository.save(room);
        redisService.evictChatParticipants(saved.getId());
        for (Long memberId : saved.getMemberIds()) {
            webSocketService.notifyChatCreated(memberId,
                    roomEnrichmentService.enrichChatWithUserData(
                            saved, memberId, roomEnrichmentService.getUnreadCount(saved.getId(), memberId)));
        }
        return roomEnrichmentService.enrichChatWithUserData(
                saved, creatorId, roomEnrichmentService.getUnreadCount(saved.getId(), creatorId));
    }

    private void cancelPendingInvite(String roomId, Long inviteeUserId) {
        roomMemberInviteRepository
                .findByRoomIdAndInviteeUserIdAndState(roomId, inviteeUserId, RoomMemberInviteState.PENDING)
                .ifPresent(invite -> {
                    invite.setState(RoomMemberInviteState.DECLINED);
                    invite.setRespondedAt(LocalDateTime.now());
                    roomMemberInviteRepository.save(invite);
                });
    }

    private void removeMemberFromRoom(ChatRoom room, Long userId) {
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

    private ChatRoom addMemberToRoom(ChatRoom room, Long newMemberId) {
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

    private void assertCanInviteMembers(ChatRoom room, Long actorId) {
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

    private void assertCanManageInvite(ChatRoom room, Long userId) {
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

    private String normalizeGroupPhoto(String raw) {
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

    private String normalizeRoomDescription(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private ChatRoom loadRoom(String roomId) {
        return chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));
    }
}
