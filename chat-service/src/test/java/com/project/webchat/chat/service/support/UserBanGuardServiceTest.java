package com.project.webchat.chat.service.support;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.exception.ForbiddenChatOperationException;
import com.project.webchat.chat.exception.UserBanException;
import com.project.webchat.chat.feign.UserServiceClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserBanGuardServiceTest {

    @Mock
    private UserServiceClient userServiceClient;

    @InjectMocks
    private UserBanGuardService userBanGuardService;

    @Test
    void isPrivateChatHiddenForViewer_hidesWhenViewerBannedOther() {
        ChatRoom room = privateRoom(1L, 2L);

        assertThat(userBanGuardService.isPrivateChatHiddenForViewer(
                room, 1L, Set.of(2L), Set.of())).isTrue();
    }

    @Test
    void isPrivateChatHiddenForViewer_hidesWhenOtherBannedViewer() {
        ChatRoom room = privateRoom(1L, 2L);

        assertThat(userBanGuardService.isPrivateChatHiddenForViewer(
                room, 1L, Set.of(), Set.of(2L))).isTrue();
    }

    @Test
    void isPrivateChatHiddenForViewer_doesNotHideGroupChats() {
        ChatRoom room = ChatRoom.builder()
                .type(ChatType.GROUP)
                .memberIds(Set.of(1L, 2L))
                .build();

        assertThat(userBanGuardService.isPrivateChatHiddenForViewer(
                room, 1L, Set.of(2L), Set.of(2L))).isFalse();
    }

    @Test
    void assertPrivateChatAccessible_throwsUserBanExceptionForBanner() {
        ChatRoom room = privateRoom(1L, 2L);
        when(userServiceClient.hasBanned(1L, 2L)).thenReturn(true);

        assertThatThrownBy(() -> userBanGuardService.assertPrivateChatAccessible(room, 1L, null))
                .isInstanceOf(UserBanException.class);
    }

    @Test
    void assertPrivateChatAccessible_throwsGenericForbiddenForBannedUser() {
        ChatRoom room = privateRoom(1L, 2L);
        when(userServiceClient.hasBanned(1L, 2L)).thenReturn(false);
        when(userServiceClient.hasBanned(2L, 1L)).thenReturn(true);

        assertThatThrownBy(() -> userBanGuardService.assertPrivateChatAccessible(room, 1L, null))
                .isInstanceOf(ForbiddenChatOperationException.class)
                .hasMessage("You are not a member of this chat");
    }

    @Test
    void isPrivateChatBlocked_returnsTrueForEitherDirection() {
        ChatRoom room = privateRoom(1L, 2L);
        when(userServiceClient.hasBanned(1L, 2L)).thenReturn(true);

        assertThat(userBanGuardService.isPrivateChatBlocked(room, 1L)).isTrue();
    }

    @Test
    void assertCanInviteUser_throwsWhenInviteeBannedInviter() {
        when(userServiceClient.hasBanned(2L, 1L)).thenReturn(true);

        assertThatThrownBy(() -> userBanGuardService.assertCanInviteUser(1L, 2L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("User not found");
    }

    @Test
    void assertCanInviteUser_allowsWhenInviterBannedInvitee() {
        when(userServiceClient.hasBanned(2L, 1L)).thenReturn(false);

        userBanGuardService.assertCanInviteUser(1L, 2L);
    }

    private static ChatRoom privateRoom(Long userId1, Long userId2) {
        return ChatRoom.builder()
                .type(ChatType.PRIVATE)
                .memberIds(Set.of(userId1, userId2))
                .build();
    }
}
