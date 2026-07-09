package com.project.webchat.chat.service.support;

import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import com.project.webchat.shared.dto.UserInfoDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoomOwnerSuccessionServiceTest {

    @Mock
    private ChatUserInfoService chatUserInfoService;

    private RoomOwnerSuccessionService successionService;

    @BeforeEach
    void setUp() {
        successionService = new RoomOwnerSuccessionService(chatUserInfoService, new ChatRoomPermissionService());
    }

    @Test
    void pickOwnerSuccessor_prefersAdminWithAlphabeticallyFirstDisplayName() {
        ChatRoom room = ChatRoom.builder()
                .type(ChatType.GROUP)
                .createdBy(1L)
                .memberIds(new HashSet<>(Set.of(1L, 2L, 3L, 4L)))
                .adminIds(new HashSet<>(Set.of(1L, 2L, 3L)))
                .build();

        when(chatUserInfoService.getUserInfoBatch(any())).thenReturn(Map.of(
                2L, user(2L, "Zara"),
                3L, user(3L, "Alice")));

        assertThat(successionService.pickOwnerSuccessor(room, 1L)).isEqualTo(3L);
    }

    @Test
    void pickOwnerSuccessor_fallsBackToStandardMemberWhenNoOtherAdmins() {
        ChatRoom room = ChatRoom.builder()
                .type(ChatType.CHANNEL)
                .createdBy(10L)
                .memberIds(new HashSet<>(Set.of(10L, 20L, 30L)))
                .adminIds(new HashSet<>(Set.of(10L)))
                .build();

        when(chatUserInfoService.getUserInfoBatch(any())).thenReturn(Map.of(
                20L, user(20L, "Mike"),
                30L, user(30L, "Anna")));

        assertThat(successionService.pickOwnerSuccessor(room, 10L)).isEqualTo(30L);
    }

    @Test
    void pickOwnerSuccessor_ignoresDepartingOwnerAndNonMembers() {
        ChatRoom room = ChatRoom.builder()
                .type(ChatType.GROUP)
                .createdBy(1L)
                .memberIds(new HashSet<>(Set.of(1L, 5L)))
                .adminIds(new HashSet<>(Set.of(1L, 9L)))
                .build();

        when(chatUserInfoService.getUserInfoBatch(any())).thenReturn(Map.of(
                5L, user(5L, "Bob")));

        assertThat(successionService.pickOwnerSuccessor(room, 1L)).isEqualTo(5L);
    }

    @Test
    void transferOwnership_setsCreatedByAndPromotesToAdmin() {
        ChatRoom room = ChatRoom.builder()
                .type(ChatType.GROUP)
                .createdBy(1L)
                .adminIds(new HashSet<>(Set.of(1L)))
                .build();

        successionService.transferOwnership(room, 7L);

        assertThat(room.getCreatedBy()).isEqualTo(7L);
        assertThat(room.getAdminIds()).contains(7L);
    }

    private static UserInfoDTO user(Long id, String firstName) {
        return UserInfoDTO.builder()
                .id(id)
                .firstName(firstName)
                .username("user" + id)
                .build();
    }
}
