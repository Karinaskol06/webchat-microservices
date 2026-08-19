package com.project.webchat.chat.service.room;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.exception.ForbiddenChatOperationException;
import com.project.webchat.chat.repository.AttachmentRepository;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.repository.RoomMemberInviteRepository;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.WebSocketService;
import com.project.webchat.chat.service.support.ChatRoomUpdateNotifier;
import com.project.webchat.chat.service.support.ChatRoomMemberMutationHelper;
import com.project.webchat.chat.service.support.ChatRoomPermissionService;
import com.project.webchat.chat.service.support.RoomOwnerSuccessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Set;

/**
 * Leave / delete / purge. Extracted from {@link ChatRoomManagementService}.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ChatRoomLifecycleService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final AttachmentRepository attachmentRepository;
    private final RoomMemberInviteRepository roomMemberInviteRepository;
    private final RedisService redisService;
    private final WebSocketService webSocketService;
    private final ChatRoomUpdateNotifier roomUpdateNotifier;
    private final ChatRoomPermissionService roomPermissionService;
    private final PersonalSpaceService personalSpaceService;
    private final RoomOwnerSuccessionService roomOwnerSuccessionService;
    private final ChatRoomMemberMutationHelper memberMutationHelper;

    @Transactional
    public void leaveChat(String chatId, Long userId) {
        ChatRoom chat = chatRoomRepository.findById(chatId)
                .orElseThrow(() -> new IllegalArgumentException("Chat not found"));

        if (!chat.getMemberIds().contains(userId)) {
            throw new IllegalArgumentException("User is not a member of this chat");
        }

        ChatType type = chat.getType() == null ? ChatType.PRIVATE : chat.getType();
        if ((type == ChatType.GROUP || type == ChatType.CHANNEL)
                && roomPermissionService.sameUserId(chat.getCreatedBy(), userId)) {
            Long successor = roomOwnerSuccessionService.pickOwnerSuccessor(chat, userId);
            if (successor != null) {
                roomOwnerSuccessionService.transferOwnership(chat, successor);
            }
        }

        Set<Long> otherMembers = new HashSet<>(chat.getMemberIds());
        otherMembers.remove(userId);
        chat.getMemberIds().remove(userId);
        if (chat.getAdminIds() != null) {
            chat.getAdminIds().remove(userId);
        }
        if (chat.getChannelPosterIds() != null) {
            chat.getChannelPosterIds().remove(userId);
        }

        if (chat.getMemberIds().isEmpty()) {
            chatRoomRepository.delete(chat);
            redisService.evictChatParticipants(chatId);
            webSocketService.notifyChatDeleted(chatId, otherMembers);
        } else {
            chatRoomRepository.save(chat);
            redisService.evictChatParticipants(chatId);
            webSocketService.notifyUserLeftChatForAll(chatId, userId, otherMembers);
            roomUpdateNotifier.notifyRoomMembersChatUpdated(chat);
        }

        redisService.markUserOffline(userId);
        webSocketService.notifyUserLeftChat(chatId, userId);
        webSocketService.notifyChatDeleted(chatId, Set.of(userId));
    }

    @Transactional
    public void deleteRoom(String roomId, Long userId) {
        ChatRoom room = memberMutationHelper.loadRoom(roomId);

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
            boolean canDelete = room.getType() == ChatType.GROUP
                    ? roomPermissionService.hasGroupAdminRights(room, userId)
                    : roomPermissionService.hasChannelModeratorRights(room, userId);
            if (!canDelete) {
                throw new ForbiddenChatOperationException("Only the creator or admins can delete this room");
            }
        }

        purgeRoom(room);
        log.info("Room {} deleted by user {}", roomId, userId);
    }

    @Transactional
    public void deleteChatForMe(String chatId, Long userId) {
        ChatRoom room = memberMutationHelper.loadRoom(chatId);
        if (!room.isMember(userId)) {
            throw new ForbiddenChatOperationException("You are not a member of this chat");
        }

        ChatType type = room.getType() == null ? ChatType.PRIVATE : room.getType();
        if (type == ChatType.PERSONAL_SPACE) {
            throw new IllegalArgumentException("Personal spaces cannot be hidden this way");
        }
        if (type == ChatType.GROUP || type == ChatType.CHANNEL) {
            leaveChat(chatId, userId);
            return;
        }

        if (room.getHiddenForMemberIds() == null) {
            room.setHiddenForMemberIds(new HashSet<>());
        }
        room.getHiddenForMemberIds().add(userId);
        chatRoomRepository.save(room);
        webSocketService.notifyChatDeleted(chatId, Set.of(userId));
    }

    @Transactional
    public void deleteChatForEveryone(String chatId, Long userId) {
        ChatRoom room = memberMutationHelper.loadRoom(chatId);
        if (!room.isMember(userId)) {
            throw new ForbiddenChatOperationException("You are not a member of this chat");
        }

        ChatType type = room.getType() == null ? ChatType.PRIVATE : room.getType();
        if (type == ChatType.PERSONAL_SPACE || type == ChatType.GROUP || type == ChatType.CHANNEL) {
            deleteRoom(chatId, userId);
            return;
        }

        purgeRoom(room);
    }

    public void purgeRoom(ChatRoom room) {
        if (room == null || room.getId() == null || room.getId().isBlank()) {
            return;
        }
        String roomId = room.getId();
        Set<Long> members = room.getMemberIds() == null ? Set.of() : new HashSet<>(room.getMemberIds());
        attachmentRepository.deleteByChatId(roomId);
        chatMessageRepository.deleteByChatId(roomId);
        roomMemberInviteRepository.deleteByRoomId(roomId);
        chatRoomRepository.delete(room);
        redisService.evictChatParticipants(roomId);
        if (!members.isEmpty()) {
            webSocketService.notifyChatDeleted(roomId, members);
        }
    }
}
