package com.project.webchat.chat.service.support;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.exception.ForbiddenChatOperationException;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Set;

@Component
public class ChatRoomPermissionService {

    public void assertCanPostMessage(ChatRoom room, Long senderId) {
        if (room.getType() != ChatType.CHANNEL) {
            return;
        }
        boolean canPost = room.getCreatedBy() != null && room.getCreatedBy().equals(senderId)
                || (room.getAdminIds() != null && room.getAdminIds().contains(senderId))
                || channelPosterIdsSet(room).contains(senderId);
        if (!canPost) {
            throw new ForbiddenChatOperationException("You do not have permission to post in this channel.");
        }
    }

    public boolean canEditOrDeleteMessage(ChatRoom room, Long actorId, Long messageSenderId) {
        if (actorId.equals(messageSenderId)) {
            return true;
        }
        if (room.getType() == ChatType.GROUP) {
            return effectiveAdminIds(room).contains(actorId);
        }
        if (room.getType() == ChatType.CHANNEL) {
            return effectiveChannelModeratorIds(room).contains(actorId);
        }
        return false;
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

    public Set<Long> effectiveAdminIds(ChatRoom room) {
        if (room.getType() != ChatType.GROUP) {
            return Set.of();
        }
        Set<Long> raw = room.getAdminIds();
        if (raw != null && !raw.isEmpty()) {
            return new HashSet<>(raw);
        }
        if (room.getCreatedBy() != null) {
            return new HashSet<>(Set.of(room.getCreatedBy()));
        }
        return new HashSet<>();
    }
}
