package com.project.webchat.chat.service.room;

import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.entity.RoomMemberInvite;
import com.project.webchat.chat.entity.RoomMemberInviteState;
import com.project.webchat.chat.feign.UserServiceClient;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.repository.RoomMemberInviteRepository;
import com.project.webchat.chat.service.ChatNotificationEventPublisher;
import com.project.webchat.chat.service.WebSocketService;
import com.project.webchat.chat.service.support.ChatRoomEnrichmentService;
import com.project.webchat.chat.service.support.ChatRoomMemberMutationHelper;
import com.project.webchat.chat.service.support.ChatRoomPermissionService;
import com.project.webchat.chat.service.support.UserBanGuardService;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatRoomInviteServiceTest {

    private static final String ROOM_ID = "room-1";
    private static final Long ACTOR_ID = 10L;
    private static final Long TARGET_ID = 20L;

    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private RoomMemberInviteRepository roomMemberInviteRepository;
    @Mock private UserServiceClient userServiceClient;
    @Mock private WebSocketService webSocketService;
    @Mock private ChatUserInfoService chatUserInfoService;
    @Mock private ChatRoomEnrichmentService roomEnrichmentService;
    @Mock private ChatRoomPermissionService roomPermissionService;
    @Mock private ChatNotificationEventPublisher chatNotificationEventPublisher;
    @Mock private UserBanGuardService userBanGuardService;
    @Mock private ChatRoomMemberMutationHelper memberMutationHelper;

    @InjectMocks
    private ChatRoomInviteService inviteService;

    @Test
    void declineRoomMemberInvite_marksDeclined() {
        RoomMemberInvite invite = RoomMemberInvite.builder()
                .id("inv-1")
                .inviteeUserId(TARGET_ID)
                .state(RoomMemberInviteState.PENDING)
                .build();
        when(roomMemberInviteRepository.findById("inv-1")).thenReturn(Optional.of(invite));

        inviteService.declineRoomMemberInvite("inv-1", TARGET_ID);

        assertThat(invite.getState()).isEqualTo(RoomMemberInviteState.DECLINED);
        assertThat(invite.getRespondedAt()).isNotNull();
        verify(roomMemberInviteRepository).save(invite);
    }

    @Test
    void acceptRoomMemberInvite_addsMemberAndAcceptsInvite() {
        RoomMemberInvite invite = RoomMemberInvite.builder()
                .id("inv-1")
                .roomId(ROOM_ID)
                .inviteeUserId(TARGET_ID)
                .state(RoomMemberInviteState.PENDING)
                .build();
        ChatRoom room = ChatRoom.builder()
                .id(ROOM_ID)
                .type(ChatType.GROUP)
                .memberIds(new HashSet<>(Set.of(ACTOR_ID)))
                .build();
        when(roomMemberInviteRepository.findById("inv-1")).thenReturn(Optional.of(invite));
        when(memberMutationHelper.loadRoom(ROOM_ID)).thenReturn(room);
        when(memberMutationHelper.addMemberToRoom(room, TARGET_ID)).thenReturn(room);
        when(roomEnrichmentService.getUnreadCount(ROOM_ID, TARGET_ID)).thenReturn(0);
        when(roomEnrichmentService.enrichChatWithUserData(eq(room), eq(TARGET_ID), anyInt()))
                .thenReturn(ChatRoomDTO.builder().id(ROOM_ID).build());

        ChatRoomDTO dto = inviteService.acceptRoomMemberInvite("inv-1", TARGET_ID);

        assertThat(dto.getId()).isEqualTo(ROOM_ID);
        assertThat(invite.getState()).isEqualTo(RoomMemberInviteState.ACCEPTED);
        verify(roomMemberInviteRepository).save(invite);
    }
}
