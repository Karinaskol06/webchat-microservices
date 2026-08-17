package com.project.webchat.chat.service.room;

import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.exception.ForbiddenChatOperationException;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.support.ChatRoomEnrichmentService;
import com.project.webchat.chat.service.support.ChatRoomMemberMutationHelper;
import com.project.webchat.chat.service.support.ChatRoomPermissionService;
import com.project.webchat.chat.service.support.UserBanGuardService;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import com.project.webchat.shared.dto.UserInfoDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Characterization tests for room list / read / reveal — behavior frozen before
 * extraction from ChatRoomManagementService.
 */
@ExtendWith(MockitoExtension.class)
class ChatRoomQueryServiceTest {

    private static final String ROOM_ID = "room-1";
    private static final Long USER_ID = 10L;
    private static final Long OTHER_ID = 20L;

    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private ChatUserInfoService chatUserInfoService;
    @Mock private ChatRoomEnrichmentService roomEnrichmentService;
    @Mock private ChatRoomPermissionService roomPermissionService;
    @Mock private UserBanGuardService userBanGuardService;
    @Mock private ChatRoomMemberMutationHelper memberMutationHelper;

    @InjectMocks
    private ChatRoomQueryService queryService;

    private ChatRoom privateRoom;

    @BeforeEach
    void setUp() {
        privateRoom = ChatRoom.builder()
                .id(ROOM_ID)
                .type(ChatType.PRIVATE)
                .memberIds(new HashSet<>(Set.of(USER_ID, OTHER_ID)))
                .hiddenForMemberIds(new HashSet<>(Set.of(USER_ID)))
                .createdAt(LocalDateTime.now())
                .lastActivity(LocalDateTime.now())
                .build();
    }

    @Test
    void revealChatForMember_whenHidden_clearsHiddenAndNotifies() {
        when(memberMutationHelper.loadRoom(ROOM_ID)).thenReturn(privateRoom);

        queryService.revealChatForMember(ROOM_ID, USER_ID);

        assertThat(privateRoom.isHiddenFor(USER_ID)).isFalse();
        verify(chatRoomRepository).save(privateRoom);
        verify(roomEnrichmentService).notifyRoomMembersChatUpdated(privateRoom);
    }

    @Test
    void revealChatForMember_whenNotHidden_isNoOp() {
        privateRoom.getHiddenForMemberIds().clear();
        when(memberMutationHelper.loadRoom(ROOM_ID)).thenReturn(privateRoom);

        queryService.revealChatForMember(ROOM_ID, USER_ID);

        verify(chatRoomRepository, never()).save(any());
        verify(roomEnrichmentService, never()).notifyRoomMembersChatUpdated(any());
    }

    @Test
    void revealChatOnNewMessage_clearsAllHiddenMembers() {
        when(chatRoomRepository.findById(ROOM_ID)).thenReturn(Optional.of(privateRoom));

        queryService.revealChatOnNewMessage(ROOM_ID);

        assertThat(privateRoom.getHiddenForMemberIds()).isEmpty();
        verify(chatRoomRepository).save(privateRoom);
        verify(roomEnrichmentService).notifyRoomMembersChatUpdated(privateRoom);
    }

    @Test
    void getRoomForMember_rejectsNonMember() {
        when(memberMutationHelper.loadRoom(ROOM_ID)).thenReturn(privateRoom);

        assertThatThrownBy(() -> queryService.getRoomForMember(ROOM_ID, 99L))
                .isInstanceOf(ForbiddenChatOperationException.class);
    }

    @Test
    void getRoomForMember_whenHidden_revealsThenEnriches() {
        when(memberMutationHelper.loadRoom(ROOM_ID)).thenReturn(privateRoom);
        when(userBanGuardService.getOtherPrivateChatMemberId(privateRoom, USER_ID)).thenReturn(OTHER_ID);
        when(chatUserInfoService.getUserInfo(OTHER_ID)).thenReturn(UserInfoDTO.builder().id(OTHER_ID).build());
        when(roomEnrichmentService.getUnreadCount(ROOM_ID, USER_ID)).thenReturn(0);
        when(roomEnrichmentService.enrichChatWithUserData(eq(privateRoom), eq(USER_ID), eq(0)))
                .thenReturn(ChatRoomDTO.builder().id(ROOM_ID).build());

        ChatRoomDTO dto = queryService.getRoomForMember(ROOM_ID, USER_ID);

        assertThat(dto.getId()).isEqualTo(ROOM_ID);
        assertThat(privateRoom.isHiddenFor(USER_ID)).isFalse();
        verify(roomPermissionService).assertNotBanned(privateRoom, USER_ID);
        verify(userBanGuardService).assertPrivateChatAccessible(eq(privateRoom), eq(USER_ID), any());
    }

    @Test
    void getAllUserChatsSorted_excludesPersonalSpaceAndHidden() {
        ChatRoom group = ChatRoom.builder()
                .id("g1")
                .type(ChatType.GROUP)
                .memberIds(Set.of(USER_ID))
                .build();
        ChatRoom personal = ChatRoom.builder()
                .id("ps1")
                .type(ChatType.PERSONAL_SPACE)
                .memberIds(Set.of(USER_ID))
                .build();
        ChatRoom hiddenPrivate = ChatRoom.builder()
                .id("p1")
                .type(ChatType.PRIVATE)
                .memberIds(Set.of(USER_ID, OTHER_ID))
                .hiddenForMemberIds(new HashSet<>(Set.of(USER_ID)))
                .build();
        Pageable pageable = PageRequest.of(0, 20);
        when(chatRoomRepository.findByMemberIdsContainsOrderByLastActivityDesc(USER_ID, pageable))
                .thenReturn(new PageImpl<>(List.of(group, personal, hiddenPrivate), pageable, 3));
        when(userBanGuardService.getBannedUserIds(USER_ID)).thenReturn(Set.of());
        when(userBanGuardService.getBanningUserIds(USER_ID)).thenReturn(Set.of());
        when(userBanGuardService.isPrivateChatHiddenForViewer(any(), eq(USER_ID), any(), any()))
                .thenReturn(false);
        when(roomEnrichmentService.getUnreadCount("g1", USER_ID)).thenReturn(1);
        when(roomEnrichmentService.enrichChatWithUserData(eq(group), eq(USER_ID), eq(1), eq(true)))
                .thenReturn(ChatRoomDTO.builder().id("g1").build());

        Page<ChatRoomDTO> page = queryService.getAllUserChatsSorted(USER_ID, pageable);

        assertThat(page.getContent()).extracting(ChatRoomDTO::getId).containsExactly("g1");
        verify(roomEnrichmentService, never())
                .enrichChatWithUserData(eq(personal), anyLong(), anyInt(), anyBoolean());
        verify(roomEnrichmentService, never())
                .enrichChatWithUserData(eq(hiddenPrivate), anyLong(), anyInt(), anyBoolean());
    }
}
