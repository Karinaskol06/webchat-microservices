package com.project.webchat.chat.service.room;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.exception.ForbiddenChatOperationException;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.support.ChatRoomEnricher;
import com.project.webchat.chat.service.support.ChatRoomUpdateNotifier;
import com.project.webchat.chat.service.support.ChatRoomMemberMutationHelper;
import com.project.webchat.chat.service.support.ChatRoomPermissionService;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatRoomModerationServiceTest {

    private static final String ROOM_ID = "room-1";
    private static final Long ACTOR_ID = 10L;
    private static final Long TARGET_ID = 20L;

    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private ChatUserInfoService chatUserInfoService;
    @Mock private ChatRoomEnricher roomEnricher;
    @Mock private ChatRoomUpdateNotifier roomUpdateNotifier;
    @Mock private ChatRoomPermissionService roomPermissionService;
    @Mock private ChatRoomMemberMutationHelper memberMutationHelper;

    @InjectMocks
    private ChatRoomModerationService moderationService;

    @Test
    void banRoomMember_rejectsBanningSelf() {
        ChatRoom room = ChatRoom.builder()
                .id(ROOM_ID)
                .type(ChatType.GROUP)
                .createdBy(99L)
                .memberIds(new HashSet<>(Set.of(ACTOR_ID, TARGET_ID)))
                .build();
        when(memberMutationHelper.loadRoom(ROOM_ID)).thenReturn(room);
        when(roomPermissionService.sameUserId(ACTOR_ID, 99L)).thenReturn(false);
        when(roomPermissionService.sameUserId(ACTOR_ID, ACTOR_ID)).thenReturn(true);

        assertThatThrownBy(() -> moderationService.banRoomMember(ROOM_ID, ACTOR_ID, ACTOR_ID))
                .isInstanceOf(ForbiddenChatOperationException.class)
                .hasMessageContaining("cannot ban yourself");
    }
}
