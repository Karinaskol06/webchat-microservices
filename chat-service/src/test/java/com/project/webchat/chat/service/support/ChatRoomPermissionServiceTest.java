package com.project.webchat.chat.service.support;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.exception.ForbiddenChatOperationException;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChatRoomPermissionServiceTest {

    private final ChatRoomPermissionService permissionService = new ChatRoomPermissionService();

    @Test
    void effectiveAdminIds_fallsBackToCreatorWhenAdminIdsEmpty() {
        ChatRoom room = ChatRoom.builder()
                .type(ChatType.GROUP)
                .createdBy(1L)
                .adminIds(new HashSet<>())
                .build();

        assertThat(permissionService.effectiveAdminIds(room)).containsExactly(1L);
    }

    @Test
    void assertCanPostMessage_blocksNonPosterInChannel() {
        ChatRoom channel = ChatRoom.builder()
                .type(ChatType.CHANNEL)
                .createdBy(99L)
                .adminIds(Set.of(99L))
                .channelPosterIds(new HashSet<>())
                .build();

        assertThatThrownBy(() -> permissionService.assertCanPostMessage(channel, 42L))
                .isInstanceOf(ForbiddenChatOperationException.class);
    }

    @Test
    void canEditOrDeleteMessage_allowsGroupAdminForOthersMessages() {
        ChatRoom room = ChatRoom.builder()
                .type(ChatType.GROUP)
                .adminIds(Set.of(5L))
                .build();

        assertThat(permissionService.canEditOrDeleteMessage(room, 5L, 10L)).isTrue();
        assertThat(permissionService.canEditOrDeleteMessage(room, 6L, 10L)).isFalse();
    }
}
