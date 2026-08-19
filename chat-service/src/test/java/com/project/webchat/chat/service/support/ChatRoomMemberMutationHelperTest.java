package com.project.webchat.chat.service.support;

import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.repository.RoomMemberInviteRepository;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.WebSocketService;
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
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatRoomMemberMutationHelperTest {

    private static final String ROOM_ID = "room-1";
    private static final Long MEMBER_ID = 10L;
    private static final Long NEW_MEMBER_ID = 20L;

    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private RoomMemberInviteRepository roomMemberInviteRepository;
    @Mock private RedisService redisService;
    @Mock private WebSocketService webSocketService;
    @Mock private ChatRoomEnricher roomEnricher;
    @Mock private ChatRoomUpdateNotifier roomUpdateNotifier;
    @Mock private ChatRoomPermissionService roomPermissionService;

    @InjectMocks
    private ChatRoomMemberMutationHelper helper;

    @Test
    void loadRoom_missing_throws() {
        when(chatRoomRepository.findById(ROOM_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> helper.loadRoom(ROOM_ID))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Chat not found");
    }

    @Test
    void addMemberToRoom_whenAlreadyMember_isNoOp() {
        ChatRoom room = groupRoom(Set.of(MEMBER_ID, NEW_MEMBER_ID));

        ChatRoom result = helper.addMemberToRoom(room, NEW_MEMBER_ID);

        assertThat(result).isSameAs(room);
        verify(chatRoomRepository, never()).save(any());
    }

    @Test
    void addMemberToRoom_whenNew_savesAndNotifies() {
        ChatRoom room = groupRoom(new HashSet<>(Set.of(MEMBER_ID)));
        when(chatRoomRepository.save(room)).thenAnswer(inv -> inv.getArgument(0));
        when(roomEnricher.getUnreadCount(ROOM_ID, NEW_MEMBER_ID)).thenReturn(0);
        when(roomEnricher.enrichChatWithUserData(eq(room), eq(NEW_MEMBER_ID), eq(0)))
                .thenReturn(ChatRoomDTO.builder().id(ROOM_ID).build());

        ChatRoom saved = helper.addMemberToRoom(room, NEW_MEMBER_ID);

        assertThat(saved.isMember(NEW_MEMBER_ID)).isTrue();
        verify(roomPermissionService).assertNotBanned(room, NEW_MEMBER_ID);
        verify(redisService).evictChatParticipants(ROOM_ID);
        verify(roomUpdateNotifier).notifyRoomMembersChatUpdated(room);
        verify(webSocketService).notifyChatCreated(eq(NEW_MEMBER_ID), any());
    }

    @Test
    void normalizeGroupPhoto_rejectsNonUrlNonData() {
        assertThatThrownBy(() -> helper.normalizeGroupPhoto("not-a-url"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private static ChatRoom groupRoom(Set<Long> members) {
        return ChatRoom.builder()
                .id(ROOM_ID)
                .type(ChatType.GROUP)
                .memberIds(members instanceof HashSet ? members : new HashSet<>(members))
                .build();
    }
}
