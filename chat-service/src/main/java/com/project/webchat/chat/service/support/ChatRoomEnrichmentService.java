package com.project.webchat.chat.service.support;

import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.entity.RoomVisibility;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.service.WebSocketService;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import com.project.webchat.shared.dto.UserInfoDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ChatRoomEnrichmentService {

    private final ChatUserInfoService chatUserInfoService;
    private final ChatRoomPermissionService roomPermissionService;
    private final ChatMessageRepository chatMessageRepository;
    private final WebSocketService webSocketService;

    public int getUnreadCount(String chatId, Long currentUserId) {
        return chatMessageRepository.findUnreadMessagesNotFromUser(chatId, currentUserId).size();
    }

    public ChatRoomDTO enrichChatWithUserData(ChatRoom chat, Long currentUserId, int unreadCount) {
        return enrichChatWithUserData(chat, currentUserId, unreadCount, false);
    }

    /**
     * @param freshUserProfiles when true, user names/avatars are loaded without Redis user cache (chat list).
     */
    public ChatRoomDTO enrichChatWithUserData(
            ChatRoom chat, Long currentUserId, int unreadCount, boolean freshUserProfiles) {
        boolean useUserCache = !freshUserProfiles;
        RoomVisibility visibility = chat.getVisibility() != null ? chat.getVisibility() : RoomVisibility.PRIVATE;

        ChatRoomDTO.ChatRoomDTOBuilder builder = ChatRoomDTO.builder()
                .id(chat.getId())
                .type(chat.getType().toString())
                .visibility(visibility.name())
                .createdAt(chat.getCreatedAt())
                .lastActivity(chat.getLastActivity())
                .lastMessage(chat.getLastMessage())
                .unreadCount(unreadCount)
                .createdBy(chat.getCreatedBy())
                .memberCount(chat.getMemberIds() != null ? chat.getMemberIds().size() : 0)
                .currentUserAdmin(roomPermissionService.hasGroupAdminRights(chat, currentUserId));

        boolean channelCreator = chat.getType() == ChatType.CHANNEL
                && roomPermissionService.sameUserId(chat.getCreatedBy(), currentUserId);
        boolean channelPromotedAdmin = chat.getType() == ChatType.CHANNEL
                && roomPermissionService.setContainsUserId(chat.getAdminIds(), currentUserId);
        boolean channelPoster = chat.getType() == ChatType.CHANNEL
                && roomPermissionService.setContainsUserId(
                        roomPermissionService.channelPosterIdsSet(chat), currentUserId);
        builder.currentUserChannelCreator(channelCreator)
                .currentUserChannelAdmin(channelPromotedAdmin)
                .currentUserChannelPoster(channelPoster);

        if (chat.getType() == ChatType.PRIVATE) {
            Long otherUserId = chat.getMemberIds().stream()
                    .filter(id -> !id.equals(currentUserId))
                    .findFirst()
                    .orElse(null);
            if (otherUserId != null) {
                UserInfoDTO otherUser = chatUserInfoService.getUserInfo(otherUserId, useUserCache);
                builder.otherUser(otherUser);
            }
        }

        if (chat.getType() == ChatType.PERSONAL_SPACE) {
            builder.groupName(chat.getGroupName() != null
                    ? chat.getGroupName()
                    : com.project.webchat.chat.service.room.PersonalSpaceService.PERSONAL_SPACE_DISPLAY_NAME);
            builder.groupPhoto(chat.getGroupPhoto());
        }

        if (chat.getType() == ChatType.GROUP || chat.getType() == ChatType.CHANNEL) {
            List<UserInfoDTO> members = chat.getMemberIds().stream()
                    .map(id -> chatUserInfoService.getUserInfo(id, useUserCache))
                    .toList();
            builder.members(members);
            builder.groupName(chat.getGroupName());
            builder.groupPhoto(chat.getGroupPhoto());
            builder.description(chat.getDescription());
            if (chat.getType() == ChatType.GROUP) {
                builder.adminUserIds(new ArrayList<>(roomPermissionService.effectiveAdminIds(chat)));
            } else if (chat.getType() == ChatType.CHANNEL) {
                builder.adminUserIds(chat.getAdminIds() == null
                        ? new ArrayList<>()
                        : new ArrayList<>(chat.getAdminIds()));
                builder.channelPosterUserIds(new ArrayList<>(roomPermissionService.channelPosterIdsSet(chat)));
            }
        }

        return builder.build();
    }

    public void notifyRoomMembersChatUpdated(ChatRoom room) {
        if (room.getMemberIds() == null || room.getMemberIds().isEmpty()) {
            return;
        }
        for (Long memberId : new HashSet<>(room.getMemberIds())) {
            ChatRoomDTO dto = enrichChatWithUserData(room, memberId, getUnreadCount(room.getId(), memberId));
            webSocketService.notifyChatUpdated(room.getId(), dto, Set.of(memberId));
        }
    }
}
