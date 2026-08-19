package com.project.webchat.chat.service.room;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.repository.AttachmentRepository;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.repository.RoomMemberInviteRepository;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.WebSocketService;
import com.project.webchat.chat.service.support.ChatRoomUpdateNotifier;
import com.project.webchat.chat.service.support.ChatRoomMemberMutationHelper;
import com.project.webchat.chat.service.support.ChatRoomPermissionService;
import com.project.webchat.chat.service.support.RoomOwnerSuccessionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatRoomLifecycleServiceTest {

    private static final String CHAT_ID = "chat-1";
    private static final Long USER_ID = 10L;
    private static final Long OTHER_ID = 20L;

    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private ChatMessageRepository chatMessageRepository;
    @Mock private AttachmentRepository attachmentRepository;
    @Mock private RoomMemberInviteRepository roomMemberInviteRepository;
    @Mock private RedisService redisService;
    @Mock private WebSocketService webSocketService;
    @Mock private ChatRoomUpdateNotifier roomUpdateNotifier;
    @Mock private ChatRoomPermissionService roomPermissionService;
    @Mock private PersonalSpaceService personalSpaceService;
    @Mock private RoomOwnerSuccessionService roomOwnerSuccessionService;
    @Mock private ChatRoomMemberMutationHelper memberMutationHelper;

    @InjectMocks
    private ChatRoomLifecycleService lifecycleService;

    @Test
    void deleteChatForMe_hidesPrivateChat() {
        ChatRoom room = ChatRoom.builder()
                .id(CHAT_ID)
                .type(ChatType.PRIVATE)
                .memberIds(new HashSet<>(Set.of(USER_ID, OTHER_ID)))
                .build();
        when(memberMutationHelper.loadRoom(CHAT_ID)).thenReturn(room);

        lifecycleService.deleteChatForMe(CHAT_ID, USER_ID);

        assertThat(room.isHiddenFor(USER_ID)).isTrue();
        verify(chatRoomRepository).save(room);
        verify(webSocketService).notifyChatDeleted(CHAT_ID, Set.of(USER_ID));
        verify(chatRoomRepository, never()).delete(any());
    }

    @Test
    void deleteChatForMe_rejectsPersonalSpace() {
        ChatRoom room = ChatRoom.builder()
                .id(CHAT_ID)
                .type(ChatType.PERSONAL_SPACE)
                .memberIds(new HashSet<>(Set.of(USER_ID)))
                .build();
        when(memberMutationHelper.loadRoom(CHAT_ID)).thenReturn(room);

        assertThatThrownBy(() -> lifecycleService.deleteChatForMe(CHAT_ID, USER_ID))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Personal spaces");
    }

    @Test
    void purgeRoom_deletesAttachmentsMessagesInvitesAndNotifies() {
        ChatRoom room = ChatRoom.builder()
                .id(CHAT_ID)
                .memberIds(new HashSet<>(Set.of(USER_ID, OTHER_ID)))
                .build();

        lifecycleService.purgeRoom(room);

        verify(attachmentRepository).deleteByChatId(CHAT_ID);
        verify(chatMessageRepository).deleteByChatId(CHAT_ID);
        verify(roomMemberInviteRepository).deleteByRoomId(CHAT_ID);
        verify(chatRoomRepository).delete(room);
        verify(redisService).evictChatParticipants(CHAT_ID);
        verify(webSocketService).notifyChatDeleted(CHAT_ID, Set.of(USER_ID, OTHER_ID));
    }

    @Test
    void leaveChat_rejectsNonMember() {
        ChatRoom room = ChatRoom.builder()
                .id(CHAT_ID)
                .type(ChatType.GROUP)
                .memberIds(new HashSet<>(Set.of(OTHER_ID)))
                .build();
        when(chatRoomRepository.findById(CHAT_ID)).thenReturn(java.util.Optional.of(room));

        assertThatThrownBy(() -> lifecycleService.leaveChat(CHAT_ID, USER_ID))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("not a member");
    }
}
