package com.project.webchat.chat.service.room;

import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.dto.UpdateRoomProfileRequest;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.RoomVisibility;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.support.ChatRoomEnricher;
import com.project.webchat.chat.service.support.ChatRoomUpdateNotifier;
import com.project.webchat.chat.service.support.ChatRoomMemberMutationHelper;
import com.project.webchat.chat.service.support.ChatRoomPermissionService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Room name, description, photo, and visibility.
 */
@Service
@RequiredArgsConstructor
public class ChatRoomProfileService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatRoomEnricher roomEnricher;
    private final ChatRoomUpdateNotifier roomUpdateNotifier;
    private final ChatRoomPermissionService roomPermissionService;
    private final ChatRoomMemberMutationHelper memberMutationHelper;

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
        boolean hasVisibility = request.getVisibility() != null;
        if (!hasName && !hasDescription && !hasPhoto && !hasVisibility) {
            throw new IllegalArgumentException("At least one field must be provided to update");
        }

        ChatRoom room = memberMutationHelper.loadRoom(roomId);
        if (hasName || hasDescription || hasPhoto) {
            roomPermissionService.assertCanManageRoomProfile(room, actorId);
        }
        if (hasVisibility) {
            roomPermissionService.assertCanChangeRoomVisibility(room, actorId);
        }

        if (hasName) {
            String name = request.getGroupName().trim();
            if (name.isEmpty()) {
                throw new IllegalArgumentException("Name is required");
            }
            room.setGroupName(name);
        }
        if (hasDescription) {
            room.setDescription(memberMutationHelper.normalizeRoomDescription(request.getDescription()));
        }
        if (hasPhoto) {
            room.setGroupPhoto(memberMutationHelper.normalizeGroupPhoto(request.getGroupPhoto()));
        }
        if (hasVisibility) {
            RoomVisibility newVisibility = request.getVisibility();
            RoomVisibility current = room.getVisibility() != null ? room.getVisibility() : RoomVisibility.PRIVATE;
            if (newVisibility != current) {
                room.setVisibility(newVisibility);
                if (newVisibility == RoomVisibility.PRIVATE) {
                    room.setInviteToken(UUID.randomUUID().toString());
                } else {
                    room.setInviteToken(null);
                }
            }
        }

        ChatRoom saved = chatRoomRepository.save(room);
        roomUpdateNotifier.notifyRoomMembersChatUpdated(saved);
        return roomEnricher.enrichChatWithUserData(
                saved, actorId, roomEnricher.getUnreadCount(saved.getId(), actorId));
    }
}
