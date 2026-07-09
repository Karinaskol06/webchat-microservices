package com.project.webchat.chat.service.support;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import com.project.webchat.shared.dto.UserInfoDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class RoomOwnerSuccessionService {

    private final ChatUserInfoService chatUserInfoService;
    private final ChatRoomPermissionService roomPermissionService;

    /**
     * Picks the next room owner when the current owner departs: an admin/moderator with the
     * alphabetically first display name, or if none remain, a standard member with the same rule.
     */
    public Long pickOwnerSuccessor(ChatRoom room, Long departingOwnerId) {
        ChatType type = room.getType();
        if (type != ChatType.GROUP && type != ChatType.CHANNEL) {
            return null;
        }

        List<Long> adminCandidates = collectAdminCandidates(room, departingOwnerId);
        Long fromAdmins = pickAlphabeticallyFirst(adminCandidates);
        if (fromAdmins != null) {
            return fromAdmins;
        }

        return pickAlphabeticallyFirst(collectStandardMemberCandidates(room, departingOwnerId));
    }

    public void transferOwnership(ChatRoom room, Long newOwnerId) {
        if (newOwnerId == null) {
            return;
        }
        room.setCreatedBy(newOwnerId);
        if (room.getAdminIds() == null) {
            room.setAdminIds(new HashSet<>());
        }
        room.getAdminIds().add(newOwnerId);
    }

    private List<Long> collectAdminCandidates(ChatRoom room, Long departingOwnerId) {
        List<Long> candidates = new ArrayList<>();
        if (room.getAdminIds() == null) {
            return candidates;
        }
        for (Long adminId : room.getAdminIds()) {
            if (adminId != null
                    && !roomPermissionService.sameUserId(adminId, departingOwnerId)
                    && room.isMember(adminId)) {
                candidates.add(adminId);
            }
        }
        return candidates;
    }

    private List<Long> collectStandardMemberCandidates(ChatRoom room, Long departingOwnerId) {
        List<Long> candidates = new ArrayList<>();
        if (room.getMemberIds() == null) {
            return candidates;
        }
        Set<Long> adminIds = room.getAdminIds() != null ? room.getAdminIds() : Set.of();
        for (Long memberId : room.getMemberIds()) {
            if (memberId != null
                    && !roomPermissionService.sameUserId(memberId, departingOwnerId)
                    && !roomPermissionService.setContainsUserId(adminIds, memberId)) {
                candidates.add(memberId);
            }
        }
        return candidates;
    }

    private Long pickAlphabeticallyFirst(List<Long> candidateIds) {
        if (candidateIds == null || candidateIds.isEmpty()) {
            return null;
        }
        Map<Long, UserInfoDTO> users = chatUserInfoService.getUserInfoBatch(new HashSet<>(candidateIds));
        return candidateIds.stream()
                .min(Comparator
                        .comparing((Long id) -> sortKey(users.get(id)))
                        .thenComparingLong(id -> id))
                .orElse(null);
    }

    private String sortKey(UserInfoDTO user) {
        if (user == null) {
            return "";
        }
        String displayName = user.getDisplayName();
        if (displayName == null || displayName.isBlank()) {
            return "";
        }
        return displayName.toLowerCase(Locale.ROOT);
    }
}
