package com.project.webchat.chat.service.room;

import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.exception.ForbiddenChatOperationException;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.support.ChatRoomEnricher;
import com.project.webchat.chat.service.support.ChatRoomUpdateNotifier;
import com.project.webchat.chat.service.support.ChatRoomMemberMutationHelper;
import com.project.webchat.chat.service.support.ChatRoomPermissionService;
import com.project.webchat.chat.service.support.UserBanGuardService;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import com.project.webchat.shared.dto.UserInfoDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Room list / read / reveal. Extracted from ChatRoomManagementService
 * so chat sidebar and open-room flows stay local to one module.
 */
@Service
@RequiredArgsConstructor
public class ChatRoomQueryService {

    private final ChatRoomRepository chatRoomRepository;
    private final RedisService redisService;
    private final ChatUserInfoService chatUserInfoService;
    private final ChatRoomEnricher roomEnricher;
    private final ChatRoomUpdateNotifier roomUpdateNotifier;
    private final ChatRoomPermissionService roomPermissionService;
    private final UserBanGuardService userBanGuardService;
    private final ChatRoomMemberMutationHelper memberMutationHelper;

    public Page<ChatRoomDTO> getAllUserChatsSorted(Long userId, Pageable pageable) {
        Page<ChatRoom> chatPage = chatRoomRepository
                .findByMemberIdsContainsOrderByLastActivityDesc(userId, pageable);

        var bannedUserIds = userBanGuardService.getBannedUserIds(userId);
        var banningUserIds = userBanGuardService.getBanningUserIds(userId);

        List<ChatRoomDTO> chatRooms = chatPage.getContent()
                .stream()
                .filter(chat -> chat.getType() != ChatType.PERSONAL_SPACE)
                .filter(chat -> !chat.isHiddenFor(userId))
                .filter(chat -> !userBanGuardService.isPrivateChatHiddenForViewer(
                        chat, userId, bannedUserIds, banningUserIds))
                .map(chat -> roomEnricher.enrichChatWithUserData(
                        chat, userId, roomEnricher.getUnreadCount(chat.getId(), userId), true))
                .toList();

        return new PageImpl<>(chatRooms, pageable, chatPage.getTotalElements());
    }

    public ChatRoomDTO getRoomForMember(String roomId, Long userId) {
        ChatRoom room = memberMutationHelper.loadRoom(roomId);
        roomPermissionService.assertNotBanned(room, userId);
        if (!room.isMember(userId)) {
            throw new ForbiddenChatOperationException("You are not a member of this chat");
        }
        if (room.getType() == ChatType.PRIVATE) {
            Long otherId = userBanGuardService.getOtherPrivateChatMemberId(room, userId);
            UserInfoDTO otherUser = otherId != null ? chatUserInfoService.getUserInfo(otherId) : null;
            userBanGuardService.assertPrivateChatAccessible(room, userId, otherUser);
        }
        if (room.isHiddenFor(userId)) {
            revealChatForMember(roomId, userId);
            room = memberMutationHelper.loadRoom(roomId);
        }
        return roomEnricher.enrichChatWithUserData(
                room, userId, roomEnricher.getUnreadCount(room.getId(), userId));
    }

    public List<UserInfoDTO> getRoomParticipantsForMember(String roomId, Long userId) {
        List<Long> cachedParticipantIds = redisService.getCachedChatParticipants(roomId);
        if (!cachedParticipantIds.isEmpty() && cachedParticipantIds.contains(userId)) {
            return cachedParticipantIds.stream()
                    .map(chatUserInfoService::getUserInfo)
                    .toList();
        }

        ChatRoom room = memberMutationHelper.loadRoom(roomId);
        if (!room.isMember(userId)) {
            throw new ForbiddenChatOperationException("You are not a member of this chat");
        }

        redisService.cacheChatParticipants(roomId, room.getMemberIds());
        return room.getMemberIds().stream()
                .map(chatUserInfoService::getUserInfo)
                .toList();
    }

    @Transactional
    public void revealChatForMember(String chatId, Long userId) {
        ChatRoom room = memberMutationHelper.loadRoom(chatId);
        if (!room.isMember(userId) || !room.isHiddenFor(userId)) {
            return;
        }
        room.getHiddenForMemberIds().removeIf(id -> id != null && id.longValue() == userId.longValue());
        chatRoomRepository.save(room);
        roomUpdateNotifier.notifyRoomMembersChatUpdated(room);
    }

    @Transactional
    public void revealChatOnNewMessage(String chatId) {
        chatRoomRepository.findById(chatId).ifPresent(room -> {
            if (room.getHiddenForMemberIds() == null || room.getHiddenForMemberIds().isEmpty()) {
                return;
            }
            room.getHiddenForMemberIds().clear();
            chatRoomRepository.save(room);
            roomUpdateNotifier.notifyRoomMembersChatUpdated(room);
        });
    }
}
