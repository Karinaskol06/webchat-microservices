package com.project.webchat.chat.service.support;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.exception.UserBanException;
import com.project.webchat.chat.feign.UserServiceClient;
import com.project.webchat.shared.dto.UserInfoDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserBanGuardService {

    private final UserServiceClient userServiceClient;

    public Set<Long> getBannedUserIds(Long userId) {
        if (userId == null) {
            return Set.of();
        }
        try {
            List<Long> ids = userServiceClient.getBannedUserIds(userId);
            if (ids == null || ids.isEmpty()) {
                return Set.of();
            }
            return ids.stream().collect(Collectors.toSet());
        } catch (Exception e) {
            return Set.of();
        }
    }

    public boolean hasBanned(Long userId, Long targetUserId) {
        if (userId == null || targetUserId == null || userId.equals(targetUserId)) {
            return false;
        }
        try {
            Boolean banned = userServiceClient.hasBanned(userId, targetUserId);
            return Boolean.TRUE.equals(banned);
        } catch (Exception e) {
            return false;
        }
    }

    public Long getOtherPrivateChatMemberId(ChatRoom room, Long userId) {
        if (room == null || room.getType() != ChatType.PRIVATE || userId == null) {
            return null;
        }
        return room.getMemberIds().stream()
                .filter(id -> !id.equals(userId))
                .findFirst()
                .orElse(null);
    }

    public void assertPrivateChatNotBannedByViewer(ChatRoom room, Long viewerId, UserInfoDTO otherUser) {
        if (room == null || room.getType() != ChatType.PRIVATE || viewerId == null) {
            return;
        }
        Long otherId = getOtherPrivateChatMemberId(room, viewerId);
        if (otherId == null) {
            return;
        }
        if (!hasBanned(viewerId, otherId)) {
            return;
        }
        String label = resolveDisplayName(otherUser, otherId);
        throw new UserBanException(label);
    }

    public boolean isPrivateChatHiddenForViewer(ChatRoom room, Long viewerId, Set<Long> bannedUserIds) {
        if (room == null || room.getType() != ChatType.PRIVATE || viewerId == null) {
            return false;
        }
        Set<Long> banned = bannedUserIds != null ? bannedUserIds : Collections.emptySet();
        Long otherId = getOtherPrivateChatMemberId(room, viewerId);
        return otherId != null && banned.contains(otherId);
    }

    private String resolveDisplayName(UserInfoDTO otherUser, Long otherId) {
        if (otherUser != null) {
            String full = ((otherUser.getFirstName() != null ? otherUser.getFirstName() : "")
                    + " "
                    + (otherUser.getLastName() != null ? otherUser.getLastName() : "")).trim();
            if (!full.isBlank()) {
                return full;
            }
            if (otherUser.getUsername() != null && !otherUser.getUsername().isBlank()) {
                return otherUser.getUsername();
            }
        }
        return otherId != null ? "User " + otherId : "this user";
    }
}
