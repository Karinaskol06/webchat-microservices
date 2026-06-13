package com.project.webchat.chat.service.room;

import com.project.webchat.chat.dto.CreatePersonalSpaceRequest;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.entity.RoomVisibility;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.support.ChatRoomEnrichmentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PersonalSpaceServiceTest {

    @Mock
    private ChatRoomRepository chatRoomRepository;

    @Mock
    private ChatRoomEnrichmentService roomEnrichmentService;

    @InjectMocks
    private PersonalSpaceService personalSpaceService;

    private ChatRoom legacyRoom;

    @BeforeEach
    void setUp() {
        legacyRoom = ChatRoom.builder()
                .id("ps-1")
                .type(ChatType.PERSONAL_SPACE)
                .memberIds(Set.of(42L))
                .groupName("Personal Space")
                .visibility(RoomVisibility.PRIVATE)
                .build();
    }

    @Test
    void listPersonalSpaces_findsRoomsByMembership() {
        when(chatRoomRepository.findByTypeAndMemberIdsContainsOrderByLastActivityDesc(
                ChatType.PERSONAL_SPACE, 42L)).thenReturn(List.of(legacyRoom));
        when(chatRoomRepository.save(legacyRoom)).thenReturn(legacyRoom);
        when(roomEnrichmentService.getUnreadCount("ps-1", 42L)).thenReturn(0);
        when(roomEnrichmentService.enrichChatWithUserData(legacyRoom, 42L, 0))
                .thenReturn(com.project.webchat.chat.dto.ChatRoomDTO.builder().id("ps-1").build());

        var result = personalSpaceService.listPersonalSpaces(42L);

        assertThat(result).hasSize(1);
        verify(chatRoomRepository).save(legacyRoom);
        assertThat(legacyRoom.getCreatedBy()).isEqualTo(42L);
    }

    @Test
    void createPersonalSpace_persistsNamedRoom() {
        var request = new CreatePersonalSpaceRequest();
        request.setName("Work notes");

        when(chatRoomRepository.save(any(ChatRoom.class))).thenAnswer(invocation -> {
            ChatRoom saved = invocation.getArgument(0);
            saved.setId("ps-new");
            return saved;
        });
        when(roomEnrichmentService.getUnreadCount("ps-new", 7L)).thenReturn(0);
        when(roomEnrichmentService.enrichChatWithUserData(any(), eq(7L), eq(0)))
                .thenReturn(com.project.webchat.chat.dto.ChatRoomDTO.builder().id("ps-new").build());

        var result = personalSpaceService.createPersonalSpace(7L, request);

        assertThat(result.getId()).isEqualTo("ps-new");
        verify(chatRoomRepository).save(any(ChatRoom.class));
    }
}
