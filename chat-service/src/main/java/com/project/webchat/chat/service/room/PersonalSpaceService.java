package com.project.webchat.chat.service.room;



import com.project.webchat.chat.dto.ChatRoomDTO;

import com.project.webchat.chat.dto.CreatePersonalSpaceRequest;

import com.project.webchat.chat.entity.ChatRoom;

import com.project.webchat.chat.entity.ChatType;

import com.project.webchat.chat.entity.RoomVisibility;

import com.project.webchat.chat.repository.ChatRoomRepository;

import com.project.webchat.chat.service.support.ChatRoomEnricher;

import lombok.RequiredArgsConstructor;

import org.springframework.stereotype.Service;

import org.springframework.transaction.annotation.Transactional;



import java.util.List;

import java.util.Set;



@Service

@RequiredArgsConstructor

public class PersonalSpaceService {



    public static final String PERSONAL_SPACE_DISPLAY_NAME = "Personal Space";



    private final ChatRoomRepository chatRoomRepository;

    private final ChatRoomEnricher roomEnricher;



    public List<ChatRoomDTO> listPersonalSpaces(Long userId) {

        return findOwnedPersonalSpaces(userId)

                .stream()

                .map(this::ensureCreatedBy)

                .map(room -> roomEnricher.enrichChatWithUserData(

                        room, userId, roomEnricher.getUnreadCount(room.getId(), userId)))

                .toList();

    }



    @Transactional

    public ChatRoomDTO getOrCreatePersonalSpace(Long userId) {

        List<ChatRoom> existing = findOwnedPersonalSpaces(userId);

        ChatRoom room = existing.isEmpty() ? createDefaultRoom(userId) : ensureCreatedBy(existing.get(0));

        int unread = roomEnricher.getUnreadCount(room.getId(), userId);

        return roomEnricher.enrichChatWithUserData(room, userId, unread);

    }



    @Transactional

    public ChatRoomDTO createPersonalSpace(Long userId, CreatePersonalSpaceRequest request) {

        String name = request.getName() == null ? "" : request.getName().trim();

        if (name.isEmpty()) {

            throw new IllegalArgumentException("Name is required");

        }

        ChatRoom room = ChatRoom.builder()

                .type(ChatType.PERSONAL_SPACE)

                .createdBy(userId)

                .memberIds(Set.of(userId))

                .groupName(name)

                .description(normalizeDescription(request.getDescription()))

                .groupPhoto(normalizeGroupPhoto(request.getGroupPhoto()))

                .visibility(RoomVisibility.PRIVATE)

                .build();

        ChatRoom saved = chatRoomRepository.save(room);

        return roomEnricher.enrichChatWithUserData(

                saved, userId, roomEnricher.getUnreadCount(saved.getId(), userId));

    }



    public long countPersonalSpacesForUser(Long userId) {

        return findOwnedPersonalSpaces(userId).size();

    }



    private List<ChatRoom> findOwnedPersonalSpaces(Long userId) {

        return chatRoomRepository.findByTypeAndMemberIdsContainsOrderByLastActivityDesc(

                ChatType.PERSONAL_SPACE, userId);

    }



    private ChatRoom ensureCreatedBy(ChatRoom room) {

        if (room.getCreatedBy() != null || room.getId() == null) {

            return room;

        }

        Long ownerId = room.getMemberIds() == null ? null : room.getMemberIds().stream()

                .filter(id -> id != null)

                .findFirst()

                .orElse(null);

        if (ownerId == null) {

            return room;

        }

        room.setCreatedBy(ownerId);

        return chatRoomRepository.save(room);

    }



    private ChatRoom createDefaultRoom(Long userId) {

        return chatRoomRepository.save(ChatRoom.builder()

                .type(ChatType.PERSONAL_SPACE)

                .createdBy(userId)

                .memberIds(Set.of(userId))

                .groupName(PERSONAL_SPACE_DISPLAY_NAME)

                .visibility(RoomVisibility.PRIVATE)

                .build());

    }



    private static String normalizeDescription(String raw) {

        if (raw == null) {

            return null;

        }

        String trimmed = raw.trim();

        return trimmed.isEmpty() ? null : trimmed;

    }



    private static String normalizeGroupPhoto(String raw) {

        if (raw == null) {

            return null;

        }

        String trimmed = raw.trim();

        return trimmed.isEmpty() ? null : trimmed;

    }

}

