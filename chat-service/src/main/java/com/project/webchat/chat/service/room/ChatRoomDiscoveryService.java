package com.project.webchat.chat.service.room;

import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.dto.DiscoverableRoomDTO;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.entity.RoomVisibility;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.support.ChatRoomEnricher;
import com.project.webchat.chat.service.support.ChatRoomUpdateNotifier;
import com.project.webchat.chat.service.support.ChatRoomPermissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Discover / search / join. Extracted from {@link ChatRoomManagementService}.
 */
@Service
@RequiredArgsConstructor
public class ChatRoomDiscoveryService {

    private final ChatRoomRepository chatRoomRepository;
    private final RedisService redisService;
    private final ChatRoomEnricher roomEnricher;
    private final ChatRoomUpdateNotifier roomUpdateNotifier;
    private final ChatRoomPermissionService roomPermissionService;

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
            return roomEnricher.enrichChatWithUserData(
                    room, userId, roomEnricher.getUnreadCount(room.getId(), userId));
        }
        roomPermissionService.assertNotBanned(room, userId);
        room.addMember(userId);
        ChatRoom saved = chatRoomRepository.save(room);
        redisService.evictChatParticipants(roomId);
        roomUpdateNotifier.notifyRoomMembersChatUpdated(saved);
        return roomEnricher.enrichChatWithUserData(
                saved, userId, roomEnricher.getUnreadCount(saved.getId(), userId));
    }

    @Transactional
    public ChatRoomDTO joinByInvite(Long userId, String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            throw new IllegalArgumentException("Invite token is required");
        }
        String token = rawToken.trim();
        ChatRoom room = chatRoomRepository.findByInviteToken(token)
                .orElseThrow(() -> new IllegalArgumentException("Invalid or expired invite"));
        if (room.getType() != ChatType.GROUP && room.getType() != ChatType.CHANNEL) {
            throw new IllegalArgumentException("Invalid invite");
        }
        RoomVisibility vis = room.getVisibility() != null ? room.getVisibility() : RoomVisibility.PRIVATE;
        if (vis != RoomVisibility.PRIVATE) {
            throw new IllegalArgumentException("This invite is not valid for this room");
        }
        if (room.isMember(userId)) {
            return roomEnricher.enrichChatWithUserData(
                    room, userId, roomEnricher.getUnreadCount(room.getId(), userId));
        }
        roomPermissionService.assertNotBanned(room, userId);
        room.addMember(userId);
        ChatRoom saved = chatRoomRepository.save(room);
        redisService.evictChatParticipants(saved.getId());
        roomUpdateNotifier.notifyRoomMembersChatUpdated(saved);
        return roomEnricher.enrichChatWithUserData(
                saved, userId, roomEnricher.getUnreadCount(saved.getId(), userId));
    }
}
