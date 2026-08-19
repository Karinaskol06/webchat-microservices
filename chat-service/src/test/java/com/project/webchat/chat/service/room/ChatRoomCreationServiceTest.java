package com.project.webchat.chat.service.room;

import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.dto.CreateGroupChannelRequest;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.entity.RoomVisibility;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.WebSocketService;
import com.project.webchat.chat.service.support.ChatRoomEnricher;
import com.project.webchat.chat.service.support.ChatRoomMemberMutationHelper;
import com.project.webchat.chat.service.support.UserBanGuardService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Characterization of group/channel create — behavior frozen from CRM.
 */
@ExtendWith(MockitoExtension.class)
class ChatRoomCreationServiceTest {

    private static final Long CREATOR_ID = 10L;

    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private RedisService redisService;
    @Mock private WebSocketService webSocketService;
    @Mock private ChatRoomEnricher roomEnricher;
    @Mock private UserBanGuardService userBanGuardService;
    @Mock private ChatRoomMemberMutationHelper memberMutationHelper;

    @InjectMocks
    private ChatRoomCreationService creationService;

    @Test
    void createGroupRoom_rejectsBlankName() {
        CreateGroupChannelRequest request = new CreateGroupChannelRequest();
        request.setName("   ");
        request.setVisibility(RoomVisibility.PRIVATE);

        assertThatThrownBy(() -> creationService.createGroupRoom(CREATOR_ID, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Name is required");
    }

    @Test
    void createGroupRoom_persistsCreatorAsAdminAndMember() {
        CreateGroupChannelRequest request = new CreateGroupChannelRequest();
        request.setName(" Engineering ");
        request.setVisibility(RoomVisibility.PRIVATE);
        request.setMemberIds(Set.of(20L));
        when(memberMutationHelper.normalizeGroupPhoto(null)).thenReturn(null);
        when(memberMutationHelper.normalizeRoomDescription(null)).thenReturn(null);
        when(chatRoomRepository.save(any(ChatRoom.class))).thenAnswer(inv -> {
            ChatRoom room = inv.getArgument(0);
            room.setId("room-new");
            return room;
        });
        when(roomEnricher.getUnreadCount(any(), anyLong())).thenReturn(0);
        when(roomEnricher.enrichChatWithUserData(any(), anyLong(), anyInt()))
                .thenReturn(ChatRoomDTO.builder().id("room-new").build());

        ChatRoomDTO dto = creationService.createGroupRoom(CREATOR_ID, request);

        assertThat(dto.getId()).isEqualTo("room-new");
        ArgumentCaptor<ChatRoom> saved = ArgumentCaptor.forClass(ChatRoom.class);
        verify(chatRoomRepository).save(saved.capture());
        ChatRoom room = saved.getValue();
        assertThat(room.getType()).isEqualTo(ChatType.GROUP);
        assertThat(room.getGroupName()).isEqualTo("Engineering");
        assertThat(room.getMemberIds()).containsExactlyInAnyOrder(CREATOR_ID, 20L);
        assertThat(room.getAdminIds()).containsExactly(CREATOR_ID);
        assertThat(room.getInviteToken()).isNotBlank();
        verify(userBanGuardService).assertCanInviteUser(CREATOR_ID, 20L);
        verify(redisService).evictChatParticipants("room-new");
        verify(webSocketService).notifyChatCreated(eq(CREATOR_ID), any());
        verify(webSocketService).notifyChatCreated(eq(20L), any());
    }
}
