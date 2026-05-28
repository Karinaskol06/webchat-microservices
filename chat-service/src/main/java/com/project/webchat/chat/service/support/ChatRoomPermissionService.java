package com.project.webchat.chat.service.support;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.exception.ForbiddenChatOperationException;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

@Component
public class ChatRoomPermissionService {

    public void assertCanPostMessage(ChatRoom room, Long senderId) {
        if (room.getType() != ChatType.CHANNEL) {
            return;
        }
        boolean canPost = sameUserId(room.getCreatedBy(), senderId)
                || setContainsUserId(room.getAdminIds(), senderId)
                || setContainsUserId(channelPosterIdsSet(room), senderId);
        if (!canPost) {
            throw new ForbiddenChatOperationException("You do not have permission to post in this channel.");
        }
    }

    public boolean canEditOrDeleteMessage(ChatRoom room, Long actorId, Long messageSenderId) {
        if (sameUserId(actorId, messageSenderId)) {
            return true;
        }
        if (room.getType() == ChatType.GROUP) {
            return hasGroupAdminRights(room, actorId);
        }
        if (room.getType() == ChatType.CHANNEL) {
            return hasChannelModeratorRights(room, actorId);
        }
        return false;
    }

    public boolean hasGroupAdminRights(ChatRoom room, Long userId) {
        return room.getType() == ChatType.GROUP && setContainsUserId(effectiveAdminIds(room), userId);
    }

    public boolean hasChannelModeratorRights(ChatRoom room, Long userId) {
        return room.getType() == ChatType.CHANNEL && setContainsUserId(effectiveChannelModeratorIds(room), userId);
    }

    public Set<Long> effectiveChannelModeratorIds(ChatRoom room) {
        if (room.getType() != ChatType.CHANNEL) {
            return Set.of();
        }
        Set<Long> out = new HashSet<>();
        if (room.getCreatedBy() != null) {
            out.add(room.getCreatedBy());
        }
        if (room.getAdminIds() != null) {
            out.addAll(room.getAdminIds());
        }
        return out;
    }

    public Set<Long> channelPosterIdsSet(ChatRoom room) {
        if (room.getChannelPosterIds() == null) {
            return new HashSet<>();
        }
        return new HashSet<>(room.getChannelPosterIds());
    }

    public void assertCanManageRoomProfile(ChatRoom room, Long actorId) {
        if (room.getType() == ChatType.PERSONAL_SPACE) {
            if (!room.isMember(actorId) || !sameUserId(room.getCreatedBy(), actorId)) {
                throw new ForbiddenChatOperationException("You cannot update this personal space profile");
            }
            return;
        }
        if (room.getType() != ChatType.GROUP && room.getType() != ChatType.CHANNEL) {
            throw new IllegalArgumentException("Profile can only be updated for groups or channels");
        }
        if (!room.isMember(actorId)) {
            throw new ForbiddenChatOperationException("You are not a member of this chat");
        }
        boolean canEdit = room.getType() == ChatType.GROUP
                ? hasGroupAdminRights(room, actorId)
                : hasChannelModeratorRights(room, actorId);
        if (!canEdit) {
            throw new ForbiddenChatOperationException("You cannot update this room profile");
        }
    }

    /**
     * GROUP admins plus the room creator (owner), who always retains admin rights.
     */
    public Set<Long> effectiveAdminIds(ChatRoom room) {
        if (room.getType() != ChatType.GROUP) {
            return Set.of();
        }
        Set<Long> out = new HashSet<>();
        if (room.getAdminIds() != null) {
            out.addAll(room.getAdminIds());
        }
        if (room.getCreatedBy() != null) {
            out.add(room.getCreatedBy());
        }
        return out;
    }

    public boolean setContainsUserId(Collection<Long> ids, Long userId) {
        if (ids == null || userId == null) {
            return false;
        }
        return ids.stream().anyMatch(id -> sameUserId(id, userId));
    }

    public boolean sameUserId(Long a, Long b) {
        return a != null && b != null && a.longValue() == b.longValue();
    }
}
