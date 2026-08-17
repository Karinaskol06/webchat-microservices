package com.project.webchat.chat.service.room;

import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.dto.DiscoverableRoomDTO;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.entity.RoomVisibility;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.support.ChatRoomEnrichmentService;
import com.project.webchat.chat.service.support.ChatRoomPermissionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatRoomDiscoveryServiceTest {

    private static final String ROOM_ID = "room-1";
    private static final Long USER_ID = 10L;

    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private RedisService redisService;
    @Mock private ChatRoomEnrichmentService roomEnrichmentService;
    @Mock private ChatRoomPermissionService roomPermissionService;

    @InjectMocks
    private ChatRoomDiscoveryService discoveryService;

    @Test
    void joinPublicRoom_rejectsPrivateVisibility() {
        ChatRoom room = ChatRoom.builder()
                .id(ROOM_ID)
                .type(ChatType.GROUP)
                .visibility(RoomVisibility.PRIVATE)
                .memberIds(new HashSet<>())
                .build();
        when(chatRoomRepository.findById(ROOM_ID)).thenReturn(Optional.of(room));

        assertThatThrownBy(() -> discoveryService.joinPublicRoom(ROOM_ID, USER_ID))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not public");
    }

    @Test
    void joinPublicRoom_whenAlreadyMember_returnsEnrichedWithoutSave() {
        ChatRoom room = ChatRoom.builder()
                .id(ROOM_ID)
                .type(ChatType.GROUP)
                .visibility(RoomVisibility.PUBLIC)
                .memberIds(new HashSet<>(Set.of(USER_ID)))
                .build();
        when(chatRoomRepository.findById(ROOM_ID)).thenReturn(Optional.of(room));
        when(roomEnrichmentService.getUnreadCount(ROOM_ID, USER_ID)).thenReturn(2);
        when(roomEnrichmentService.enrichChatWithUserData(room, USER_ID, 2))
                .thenReturn(ChatRoomDTO.builder().id(ROOM_ID).build());

        ChatRoomDTO dto = discoveryService.joinPublicRoom(ROOM_ID, USER_ID);

        assertThat(dto.getId()).isEqualTo(ROOM_ID);
        verify(chatRoomRepository, never()).save(any());
    }

    @Test
    void joinByInvite_addsMemberWhenValid() {
        ChatRoom room = ChatRoom.builder()
                .id(ROOM_ID)
                .type(ChatType.GROUP)
                .visibility(RoomVisibility.PRIVATE)
                .inviteToken("tok-1")
                .memberIds(new HashSet<>(Set.of(20L)))
                .build();
        when(chatRoomRepository.findByInviteToken("tok-1")).thenReturn(Optional.of(room));
        when(chatRoomRepository.save(room)).thenReturn(room);
        when(roomEnrichmentService.getUnreadCount(ROOM_ID, USER_ID)).thenReturn(0);
        when(roomEnrichmentService.enrichChatWithUserData(eq(room), eq(USER_ID), anyInt()))
                .thenReturn(ChatRoomDTO.builder().id(ROOM_ID).build());

        ChatRoomDTO dto = discoveryService.joinByInvite(USER_ID, " tok-1 ");

        assertThat(dto.getId()).isEqualTo(ROOM_ID);
        assertThat(room.isMember(USER_ID)).isTrue();
        verify(roomPermissionService).assertNotBanned(room, USER_ID);
        verify(redisService).evictChatParticipants(ROOM_ID);
        verify(roomEnrichmentService).notifyRoomMembersChatUpdated(room);
    }
}
