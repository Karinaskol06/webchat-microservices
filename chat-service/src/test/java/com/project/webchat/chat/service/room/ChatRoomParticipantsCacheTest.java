package com.project.webchat.chat.service.room;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.exception.ForbiddenChatOperationException;
import com.project.webchat.chat.feign.UserServiceClient;
import com.project.webchat.chat.repository.AttachmentRepository;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.repository.RoomMemberInviteRepository;
import com.project.webchat.chat.service.ChatNotificationEventPublisher;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.WebSocketService;
import com.project.webchat.chat.service.support.ChatRoomEnrichmentService;
import com.project.webchat.chat.service.support.ChatRoomPermissionService;
import com.project.webchat.chat.service.support.RoomOwnerSuccessionService;
import com.project.webchat.chat.service.support.UserBanGuardService;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import com.project.webchat.shared.dto.UserInfoDTO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for participant cache behavior in {@link ChatRoomManagementService}.
 * Mocks {@link RedisService} at the service boundary. Unit testing cache policy.
 */
@ExtendWith(MockitoExtension.class)
class ChatRoomParticipantsCacheTest {

    private static final String ROOM_ID = "room-1";
    private static final Long MEMBER_ID = 10L;

    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private ChatMessageRepository chatMessageRepository;
    @Mock private AttachmentRepository attachmentRepository;
    @Mock private RoomMemberInviteRepository roomMemberInviteRepository;
    @Mock private UserServiceClient userServiceClient;
    @Mock private RedisService redisService;
    @Mock private WebSocketService webSocketService;
    @Mock private ChatUserInfoService chatUserInfoService;
    @Mock private ChatRoomEnrichmentService roomEnrichmentService;
    @Mock private ChatRoomPermissionService roomPermissionService;
    @Mock private ChatNotificationEventPublisher chatNotificationEventPublisher;
    @Mock private PersonalSpaceService personalSpaceService;
    @Mock private UserBanGuardService userBanGuardService;
    @Mock private RoomOwnerSuccessionService roomOwnerSuccessionService;

    @InjectMocks
    private ChatRoomManagementService chatRoomManagementService;

    @Test
    void firstCall_loadsFromMongo_andCachesParticipantIds() {
        ChatRoom room = groupRoom(Set.of(10L, 11L, 12L));
        when(redisService.getCachedChatParticipants(ROOM_ID)).thenReturn(List.of());
        when(chatRoomRepository.findById(ROOM_ID)).thenReturn(Optional.of(room));
        when(chatUserInfoService.getUserInfo(anyLong())).thenAnswer(inv -> userInfo(inv.getArgument(0)));

        var result = chatRoomManagementService.getRoomParticipantsForMember(ROOM_ID, MEMBER_ID);

        assertThat(result).extracting(UserInfoDTO::getId).containsExactlyInAnyOrder(10L, 11L, 12L);
        verify(chatRoomRepository).findById(ROOM_ID);
        verify(redisService).cacheChatParticipants(ROOM_ID, room.getMemberIds());
    }

    @Test
    void secondCall_whenCacheHit_skipsMongoLookup() {
        when(redisService.getCachedChatParticipants(ROOM_ID))
                .thenReturn(List.of())
                .thenReturn(List.of(10L, 11L, 12L));
        when(chatRoomRepository.findById(ROOM_ID)).thenReturn(Optional.of(groupRoom(Set.of(10L, 11L, 12L))));
        when(chatUserInfoService.getUserInfo(anyLong())).thenAnswer(inv -> userInfo(inv.getArgument(0)));

        chatRoomManagementService.getRoomParticipantsForMember(ROOM_ID, MEMBER_ID);
        var cached = chatRoomManagementService.getRoomParticipantsForMember(ROOM_ID, MEMBER_ID);

        assertThat(cached).hasSize(3);
        verify(chatRoomRepository, times(1)).findById(ROOM_ID);
        verify(redisService, times(1)).cacheChatParticipants(any(), any());
    }

    @Test
    void nonMember_isRejected_evenIfCacheIsEmpty() {
        when(redisService.getCachedChatParticipants(ROOM_ID)).thenReturn(List.of());
        when(chatRoomRepository.findById(ROOM_ID))
                .thenReturn(Optional.of(groupRoom(Set.of(11L, 12L))));

        assertThatThrownBy(() ->
                chatRoomManagementService.getRoomParticipantsForMember(ROOM_ID, MEMBER_ID))
                .isInstanceOf(ForbiddenChatOperationException.class);

        verify(redisService, never()).cacheChatParticipants(any(), any());
    }

    private static ChatRoom groupRoom(Set<Long> memberIds) {
        return ChatRoom.builder()
                .id(ROOM_ID)
                .type(ChatType.GROUP)
                .memberIds(memberIds)
                .createdAt(LocalDateTime.now())
                .lastActivity(LocalDateTime.now())
                .build();
    }

    private static UserInfoDTO userInfo(Long id) {
        return UserInfoDTO.builder()
                .id(id)
                .username("user-" + id)
                .build();
    }
}
