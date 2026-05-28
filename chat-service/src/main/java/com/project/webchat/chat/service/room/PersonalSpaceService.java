package com.project.webchat.chat.service.room;

import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.entity.RoomVisibility;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.support.ChatRoomEnrichmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

@Service
@RequiredArgsConstructor
public class PersonalSpaceService {

    public static final String PERSONAL_SPACE_DISPLAY_NAME = "Personal Space";

    private final ChatRoomRepository chatRoomRepository;
    private final ChatRoomEnrichmentService roomEnrichmentService;

    @Transactional
    public ChatRoomDTO getOrCreatePersonalSpace(Long userId) {
        ChatRoom room = chatRoomRepository.findByTypeAndCreatedBy(ChatType.PERSONAL_SPACE, userId)
                .orElseGet(() -> chatRoomRepository.save(ChatRoom.builder()
                        .type(ChatType.PERSONAL_SPACE)
                        .createdBy(userId)
                        .memberIds(Set.of(userId))
                        .groupName(PERSONAL_SPACE_DISPLAY_NAME)
                        .visibility(RoomVisibility.PRIVATE)
                        .build()));
        int unread = roomEnrichmentService.getUnreadCount(room.getId(), userId);
        return roomEnrichmentService.enrichChatWithUserData(room, userId, unread);
    }
}
