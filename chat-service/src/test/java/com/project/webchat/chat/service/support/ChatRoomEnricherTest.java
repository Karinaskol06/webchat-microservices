package com.project.webchat.chat.service.support;

import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.entity.ChatMessage;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.entity.RoomVisibility;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import com.project.webchat.shared.dto.UserInfoDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

/**
 * Characterization tests for pure room enrichment. No WebSocketService dependency.
 * Targets ChatRoomEnricher once the split is complete.
 */
@ExtendWith(MockitoExtension.class)
class ChatRoomEnricherTest {

    @Mock
    private ChatUserInfoService chatUserInfoService;

    @Mock
    private ChatRoomPermissionService roomPermissionService;

    @Mock
    private ChatMessageRepository chatMessageRepository;

    private ChatRoomEnricher enricher;

    @BeforeEach
    void setUp() {
        enricher = new ChatRoomEnricher(chatUserInfoService, roomPermissionService, chatMessageRepository);
    }

    // Personal Space

    @Test
    void enrichChatWithUserData_includesDescriptionForPersonalSpace() {
        ChatRoom room = ChatRoom.builder()
                .id("ps-1")
                .type(ChatType.PERSONAL_SPACE)
                .memberIds(Set.of(42L))
                .createdBy(42L)
                .groupName("Work notes")
                .description("Project reminders and drafts")
                .visibility(RoomVisibility.PRIVATE)
                .build();

        when(roomPermissionService.hasGroupAdminRights(room, 42L)).thenReturn(false);

        ChatRoomDTO dto = enricher.enrichChatWithUserData(room, 42L, 0);

        assertThat(dto.getGroupName()).isEqualTo("Work notes");
        assertThat(dto.getDescription()).isEqualTo("Project reminders and drafts");
    }

    // Private Room

    @Test
    void enrichChatWithUserData_privateRoom_populatesOtherUser() {
        ChatRoom room = ChatRoom.builder()
                .id("priv-1")
                .type(ChatType.PRIVATE)
                .memberIds(Set.of(1L, 2L))
                .createdBy(1L)
                .visibility(RoomVisibility.PRIVATE)
                .build();

        UserInfoDTO otherUser = UserInfoDTO.builder().id(2L).username("alice").build();
        when(chatUserInfoService.getUserInfo(2L, true)).thenReturn(otherUser);
        when(roomPermissionService.hasGroupAdminRights(room, 1L)).thenReturn(false);

        ChatRoomDTO dto = enricher.enrichChatWithUserData(room, 1L, 3);

        assertThat(dto.getOtherUser()).isNotNull();
        assertThat(dto.getOtherUser().getUsername()).isEqualTo("alice");
        assertThat(dto.getUnreadCount()).isEqualTo(3);
        assertThat(dto.getMembers()).isNull();
    }

    @Test
    void enrichChatWithUserData_privateRoom_noMembersListInDTO() {
        ChatRoom room = ChatRoom.builder()
                .id("priv-2")
                .type(ChatType.PRIVATE)
                .memberIds(Set.of(10L, 20L))
                .createdBy(10L)
                .visibility(RoomVisibility.PRIVATE)
                .build();

        when(chatUserInfoService.getUserInfo(20L, true)).thenReturn(UserInfoDTO.builder().id(20L).build());
        when(roomPermissionService.hasGroupAdminRights(room, 10L)).thenReturn(false);

        ChatRoomDTO dto = enricher.enrichChatWithUserData(room, 10L, 0);

        assertThat(dto.getMembers()).isNull();
        assertThat(dto.getGroupName()).isNull();
    }

    // Group Room

    @Test
    void enrichChatWithUserData_groupRoom_populatesMembersAndAdminIds() {
        ChatRoom room = ChatRoom.builder()
                .id("grp-1")
                .type(ChatType.GROUP)
                .memberIds(Set.of(1L, 2L, 3L))
                .adminIds(Set.of(1L))
                .createdBy(1L)
                .groupName("Team Alpha")
                .visibility(RoomVisibility.PUBLIC)
                .build();

        when(chatUserInfoService.getUserInfo(1L, true)).thenReturn(UserInfoDTO.builder().id(1L).username("admin").build());
        when(chatUserInfoService.getUserInfo(2L, true)).thenReturn(UserInfoDTO.builder().id(2L).username("bob").build());
        when(chatUserInfoService.getUserInfo(3L, true)).thenReturn(UserInfoDTO.builder().id(3L).username("carol").build());
        when(roomPermissionService.hasGroupAdminRights(room, 1L)).thenReturn(true);
        when(roomPermissionService.canModerateMembers(room, 1L)).thenReturn(true);
        when(roomPermissionService.effectiveAdminIds(room)).thenReturn(Set.of(1L));

        ChatRoomDTO dto = enricher.enrichChatWithUserData(room, 1L, 0);

        assertThat(dto.getMembers()).hasSize(3);
        assertThat(dto.getGroupName()).isEqualTo("Team Alpha");
        assertThat(dto.getAdminUserIds()).contains(1L);
        assertThat(dto.isCurrentUserAdmin()).isTrue();
        assertThat(dto.isCurrentUserCanModerateMembers()).isTrue();
    }

    @Test
    void enrichChatWithUserData_groupRoom_moderatorSeesBannedMembers() {
        ChatRoom room = ChatRoom.builder()
                .id("grp-2")
                .type(ChatType.GROUP)
                .memberIds(Set.of(1L, 2L))
                .adminIds(Set.of(1L))
                .bannedUserIds(Set.of(99L))
                .createdBy(1L)
                .groupName("Team Beta")
                .visibility(RoomVisibility.PRIVATE)
                .build();

        when(chatUserInfoService.getUserInfo(1L, true)).thenReturn(UserInfoDTO.builder().id(1L).username("admin").build());
        when(chatUserInfoService.getUserInfo(2L, true)).thenReturn(UserInfoDTO.builder().id(2L).username("bob").build());
        when(chatUserInfoService.getUserInfo(99L, true)).thenReturn(UserInfoDTO.builder().id(99L).username("eve").build());
        when(roomPermissionService.hasGroupAdminRights(room, 1L)).thenReturn(true);
        when(roomPermissionService.canModerateMembers(room, 1L)).thenReturn(true);
        when(roomPermissionService.effectiveAdminIds(room)).thenReturn(Set.of(1L));

        ChatRoomDTO dto = enricher.enrichChatWithUserData(room, 1L, 0);

        assertThat(dto.getBannedMembers()).hasSize(1);
        assertThat(dto.getBannedMembers().get(0).getUsername()).isEqualTo("eve");
    }

    @Test
    void enrichChatWithUserData_groupRoom_nonModeratorDoesNotSeeBannedMembers() {
        ChatRoom room = ChatRoom.builder()
                .id("grp-3")
                .type(ChatType.GROUP)
                .memberIds(Set.of(1L, 2L))
                .adminIds(Set.of(1L))
                .bannedUserIds(Set.of(99L))
                .createdBy(1L)
                .groupName("Team Gamma")
                .visibility(RoomVisibility.PRIVATE)
                .build();

        when(chatUserInfoService.getUserInfo(1L, true)).thenReturn(UserInfoDTO.builder().id(1L).build());
        when(chatUserInfoService.getUserInfo(2L, true)).thenReturn(UserInfoDTO.builder().id(2L).build());
        when(roomPermissionService.hasGroupAdminRights(room, 2L)).thenReturn(false);
        when(roomPermissionService.canModerateMembers(room, 2L)).thenReturn(false);
        when(roomPermissionService.effectiveAdminIds(room)).thenReturn(Set.of(1L));

        ChatRoomDTO dto = enricher.enrichChatWithUserData(room, 2L, 0);

        assertThat(dto.getBannedMembers()).isNull();
        assertThat(dto.isCurrentUserCanModerateMembers()).isFalse();
    }

    // Channel Room

    @Test
    void enrichChatWithUserData_channelRoom_creatorFlagsSet() {
        ChatRoom room = ChatRoom.builder()
                .id("ch-1")
                .type(ChatType.CHANNEL)
                .memberIds(Set.of(1L, 2L))
                .adminIds(Set.of())
                .channelPosterIds(Set.of())
                .createdBy(1L)
                .groupName("News")
                .visibility(RoomVisibility.PUBLIC)
                .build();

        when(chatUserInfoService.getUserInfo(anyLong(), anyBoolean())).thenReturn(UserInfoDTO.builder().id(1L).build());
        when(roomPermissionService.hasGroupAdminRights(room, 1L)).thenReturn(false);
        when(roomPermissionService.sameUserId(1L, 1L)).thenReturn(true);
        when(roomPermissionService.setContainsUserId(any(), eq(1L))).thenReturn(false);
        when(roomPermissionService.channelPosterIdsSet(room)).thenReturn(Set.of());
        when(roomPermissionService.canModerateMembers(room, 1L)).thenReturn(true);

        ChatRoomDTO dto = enricher.enrichChatWithUserData(room, 1L, 0);

        assertThat(dto.isCurrentUserChannelCreator()).isTrue();
        assertThat(dto.isCurrentUserChannelAdmin()).isFalse();
        assertThat(dto.isCurrentUserChannelPoster()).isFalse();
    }

    @Test
    void enrichChatWithUserData_channelRoom_promotedAdminFlagSet() {
        ChatRoom room = ChatRoom.builder()
                .id("ch-2")
                .type(ChatType.CHANNEL)
                .memberIds(Set.of(1L, 2L))
                .adminIds(Set.of(2L))
                .channelPosterIds(Set.of())
                .createdBy(1L)
                .groupName("Announcements")
                .visibility(RoomVisibility.PUBLIC)
                .build();

        when(chatUserInfoService.getUserInfo(anyLong(), anyBoolean())).thenReturn(UserInfoDTO.builder().id(2L).build());
        when(roomPermissionService.hasGroupAdminRights(room, 2L)).thenReturn(false);
        when(roomPermissionService.sameUserId(1L, 2L)).thenReturn(false);
        when(roomPermissionService.setContainsUserId(eq(Set.of(2L)), eq(2L))).thenReturn(true);
        when(roomPermissionService.channelPosterIdsSet(room)).thenReturn(Set.of());
        when(roomPermissionService.setContainsUserId(eq(Set.of()), eq(2L))).thenReturn(false);
        when(roomPermissionService.canModerateMembers(room, 2L)).thenReturn(true);

        ChatRoomDTO dto = enricher.enrichChatWithUserData(room, 2L, 0);

        assertThat(dto.isCurrentUserChannelCreator()).isFalse();
        assertThat(dto.isCurrentUserChannelAdmin()).isTrue();
    }

    @Test
    void enrichChatWithUserData_channelRoom_channelPosterUserIdsPopulated() {
        ChatRoom room = ChatRoom.builder()
                .id("ch-3")
                .type(ChatType.CHANNEL)
                .memberIds(Set.of(1L, 5L))
                .adminIds(Set.of())
                .channelPosterIds(Set.of(5L))
                .createdBy(1L)
                .groupName("Dev Updates")
                .visibility(RoomVisibility.PUBLIC)
                .build();

        when(chatUserInfoService.getUserInfo(anyLong(), anyBoolean())).thenReturn(UserInfoDTO.builder().id(1L).build());
        when(roomPermissionService.hasGroupAdminRights(room, 1L)).thenReturn(false);
        when(roomPermissionService.sameUserId(1L, 1L)).thenReturn(true);
        when(roomPermissionService.setContainsUserId(any(), eq(1L))).thenReturn(false);
        when(roomPermissionService.channelPosterIdsSet(room)).thenReturn(Set.of(5L));
        when(roomPermissionService.canModerateMembers(room, 1L)).thenReturn(true);

        ChatRoomDTO dto = enricher.enrichChatWithUserData(room, 1L, 0);

        assertThat(dto.getChannelPosterUserIds()).contains(5L);
    }

    // ─── Unread Count ─────────────────────────────────────────────────────────

    @Test
    void getUnreadCount_delegatesToCountQuery() {
        when(chatMessageRepository.countUnreadMessagesNotFromUser("room-1", 7L)).thenReturn(2L);

        int count = enricher.getUnreadCount("room-1", 7L);

        assertThat(count).isEqualTo(2);
    }

    // ─── enrichChatForList (lightweight sidebar path) ─────────────────────────

    @Test
    void enrichChatForList_privateRoom_includesOtherUserAndBaseFields() {
        ChatRoom room = ChatRoom.builder()
                .id("priv-list")
                .type(ChatType.PRIVATE)
                .memberIds(Set.of(1L, 2L))
                .createdBy(1L)
                .lastMessage("hello")
                .visibility(RoomVisibility.PRIVATE)
                .build();

        UserInfoDTO other = UserInfoDTO.builder().id(2L).username("alice").build();
        when(chatUserInfoService.getUserInfo(2L, true)).thenReturn(other);

        ChatRoomDTO dto = enricher.enrichChatForList(room, 1L, 3);

        assertThat(dto.getId()).isEqualTo("priv-list");
        assertThat(dto.getType()).isEqualTo("PRIVATE");
        assertThat(dto.getUnreadCount()).isEqualTo(3);
        assertThat(dto.getLastMessage()).isEqualTo("hello");
        assertThat(dto.getOtherUser()).isNotNull();
        assertThat(dto.getOtherUser().getUsername()).isEqualTo("alice");
        // heavy fields must be absent
        assertThat(dto.getMembers()).isNull();
        assertThat(dto.getAdminUserIds()).isNull();
    }

    @Test
    void enrichChatForList_groupRoom_includesNameAndPhotoOnly_noMemberList() {
        ChatRoom room = ChatRoom.builder()
                .id("grp-list")
                .type(ChatType.GROUP)
                .memberIds(Set.of(1L, 2L, 3L))
                .adminIds(Set.of(1L))
                .createdBy(1L)
                .groupName("Team Alpha")
                .groupPhoto("https://example.com/photo.jpg")
                .visibility(RoomVisibility.PUBLIC)
                .build();

        ChatRoomDTO dto = enricher.enrichChatForList(room, 1L, 0);

        assertThat(dto.getGroupName()).isEqualTo("Team Alpha");
        assertThat(dto.getGroupPhoto()).isEqualTo("https://example.com/photo.jpg");
        assertThat(dto.getMemberCount()).isEqualTo(3);
        // heavy fields must be absent
        assertThat(dto.getMembers()).isNull();
        assertThat(dto.getAdminUserIds()).isNull();
        assertThat(dto.getBannedMembers()).isNull();
        assertThat(dto.isCurrentUserAdmin()).isFalse();
        assertThat(dto.isCurrentUserCanModerateMembers()).isFalse();
    }

    @Test
    void enrichChatForList_channelRoom_includesNameAndPhotoOnly_noPermissionFlags() {
        ChatRoom room = ChatRoom.builder()
                .id("ch-list")
                .type(ChatType.CHANNEL)
                .memberIds(Set.of(1L, 2L))
                .adminIds(Set.of(2L))
                .channelPosterIds(Set.of(1L))
                .createdBy(2L)
                .groupName("Announcements")
                .visibility(RoomVisibility.PUBLIC)
                .build();

        ChatRoomDTO dto = enricher.enrichChatForList(room, 1L, 1);

        assertThat(dto.getGroupName()).isEqualTo("Announcements");
        assertThat(dto.getUnreadCount()).isEqualTo(1);
        // heavy fields must be absent
        assertThat(dto.getMembers()).isNull();
        assertThat(dto.getChannelPosterUserIds()).isNull();
        assertThat(dto.isCurrentUserChannelCreator()).isFalse();
        assertThat(dto.isCurrentUserChannelAdmin()).isFalse();
        assertThat(dto.isCurrentUserChannelPoster()).isFalse();
    }

    @Test
    void enrichChatForList_personalSpace_includesNameAndDescription() {
        ChatRoom room = ChatRoom.builder()
                .id("ps-list")
                .type(ChatType.PERSONAL_SPACE)
                .memberIds(Set.of(42L))
                .createdBy(42L)
                .groupName("My Notes")
                .description("Private drafts")
                .visibility(RoomVisibility.PRIVATE)
                .build();

        ChatRoomDTO dto = enricher.enrichChatForList(room, 42L, 0);

        assertThat(dto.getGroupName()).isEqualTo("My Notes");
        assertThat(dto.getDescription()).isEqualTo("Private drafts");
        assertThat(dto.getMembers()).isNull();
    }
}
