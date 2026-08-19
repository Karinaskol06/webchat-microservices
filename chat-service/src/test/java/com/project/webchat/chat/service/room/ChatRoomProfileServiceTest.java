package com.project.webchat.chat.service.room;

import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.dto.UpdateRoomProfileRequest;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.support.ChatRoomEnricher;
import com.project.webchat.chat.service.support.ChatRoomUpdateNotifier;
import com.project.webchat.chat.service.support.ChatRoomMemberMutationHelper;
import com.project.webchat.chat.service.support.ChatRoomPermissionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatRoomProfileServiceTest {

    private static final String ROOM_ID = "room-1";
    private static final Long ACTOR_ID = 10L;

    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private ChatRoomEnricher roomEnricher;
    @Mock private ChatRoomUpdateNotifier roomUpdateNotifier;
    @Mock private ChatRoomPermissionService roomPermissionService;
    @Mock private ChatRoomMemberMutationHelper memberMutationHelper;

    @InjectMocks
    private ChatRoomProfileService profileService;

    @Test
    void updateRoomProfile_rejectsEmptyPayload() {
        assertThatThrownBy(() -> profileService.updateRoomProfile(ROOM_ID, ACTOR_ID, new UpdateRoomProfileRequest()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("At least one field");
    }

    @Test
    void updateRoomProfile_savesNameAndNotifies() {
        ChatRoom room = ChatRoom.builder()
                .id(ROOM_ID)
                .type(ChatType.GROUP)
                .memberIds(new HashSet<>(Set.of(ACTOR_ID)))
                .groupName("Old")
                .build();
        when(memberMutationHelper.loadRoom(ROOM_ID)).thenReturn(room);
        when(chatRoomRepository.save(room)).thenReturn(room);
        when(roomEnricher.getUnreadCount(ROOM_ID, ACTOR_ID)).thenReturn(0);
        when(roomEnricher.enrichChatWithUserData(eq(room), eq(ACTOR_ID), anyInt()))
                .thenReturn(ChatRoomDTO.builder().id(ROOM_ID).build());

        UpdateRoomProfileRequest request = new UpdateRoomProfileRequest();
        request.setGroupName(" Engineering ");

        ChatRoomDTO dto = profileService.updateRoomProfile(ROOM_ID, ACTOR_ID, request);

        assertThat(dto.getId()).isEqualTo(ROOM_ID);
        assertThat(room.getGroupName()).isEqualTo("Engineering");
        verify(roomPermissionService).assertCanManageRoomProfile(room, ACTOR_ID);
        verify(roomUpdateNotifier).notifyRoomMembersChatUpdated(room);
    }
}
