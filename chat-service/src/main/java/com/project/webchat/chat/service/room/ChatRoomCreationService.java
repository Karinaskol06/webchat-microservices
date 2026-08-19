package com.project.webchat.chat.service.room;

import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.dto.CreateGroupChannelRequest;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.entity.RoomVisibility;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.WebSocketService;
import com.project.webchat.chat.service.support.ChatRoomEnricher;
import com.project.webchat.chat.service.support.ChatRoomMemberMutationHelper;
import com.project.webchat.chat.service.support.UserBanGuardService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Create group / channel rooms. Extracted from {@link ChatRoomManagementService}.
 */
@Service
@RequiredArgsConstructor
public class ChatRoomCreationService {

    private final ChatRoomRepository chatRoomRepository;
    private final RedisService redisService;
    private final WebSocketService webSocketService;
    private final ChatRoomEnricher roomEnricher;
    private final UserBanGuardService userBanGuardService;
    private final ChatRoomMemberMutationHelper memberMutationHelper;

    @Transactional
    public ChatRoomDTO createGroupRoom(Long creatorId, CreateGroupChannelRequest request) {
        return createGroupOrChannelRoom(creatorId, request, ChatType.GROUP);
    }

    @Transactional
    public ChatRoomDTO createChannelRoom(Long creatorId, CreateGroupChannelRequest request) {
        return createGroupOrChannelRoom(creatorId, request, ChatType.CHANNEL);
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
        String inviteToken = visibility == RoomVisibility.PRIVATE ? UUID.randomUUID().toString() : null;
        Set<Long> adminIds = type == ChatType.GROUP ? new HashSet<>(Set.of(creatorId)) : new HashSet<>();
        String groupPhoto = memberMutationHelper.normalizeGroupPhoto(request.getGroupPhoto());
        String description = memberMutationHelper.normalizeRoomDescription(request.getDescription());

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
                    roomEnricher.enrichChatWithUserData(
                            saved, memberId, roomEnricher.getUnreadCount(saved.getId(), memberId)));
        }
        return roomEnricher.enrichChatWithUserData(
                saved, creatorId, roomEnricher.getUnreadCount(saved.getId(), creatorId));
    }
}
