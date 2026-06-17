package com.project.webchat.chat.service.support;

import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.entity.RoomVisibility;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.service.WebSocketService;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatRoomEnrichmentServiceTest {

    @Mock
    private ChatUserInfoService chatUserInfoService;

    @Mock
    private ChatRoomPermissionService roomPermissionService;

    @Mock
    private ChatMessageRepository chatMessageRepository;

    @Mock
    private WebSocketService webSocketService;

    private ChatRoomEnrichmentService enrichmentService;

    @BeforeEach
    void setUp() {
        enrichmentService = new ChatRoomEnrichmentService(
                chatUserInfoService,
                roomPermissionService,
                chatMessageRepository,
                webSocketService);
    }

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

        ChatRoomDTO dto = enrichmentService.enrichChatWithUserData(room, 42L, 0);

        assertThat(dto.getGroupName()).isEqualTo("Work notes");
        assertThat(dto.getDescription()).isEqualTo("Project reminders and drafts");
    }
}
