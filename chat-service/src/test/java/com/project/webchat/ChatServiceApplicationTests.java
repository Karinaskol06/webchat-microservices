package com.project.webchat;

import com.project.webchat.chat.repository.AttachmentRepository;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.repository.RoomMemberInviteRepository;
import com.project.webchat.chat.service.ChatService;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.message.ChatMessageCommandService;
import com.project.webchat.chat.service.message.MessageReactionService;
import com.project.webchat.chat.service.room.ChatRoomManagementService;
import com.project.webchat.chat.service.room.PrivateChatService;
import com.project.webchat.chat.service.support.ChatRoomEnrichmentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = com.project.webchat.chat.ChatServiceApplication.class)
@ActiveProfiles("test")
class ChatServiceApplicationTests {

    @MockBean
    private ChatMessageRepository chatMessageRepository;
    @MockBean
    private ChatRoomRepository chatRoomRepository;
    @MockBean
    private RoomMemberInviteRepository roomMemberInviteRepository;
    @MockBean
    private AttachmentRepository attachmentRepository;
    @MockBean
    private RedisService redisService;
    @MockBean
    private KafkaTemplate<?, ?> kafkaTemplate;

    @Autowired
    private ChatService chatService;

    @Autowired
    private PrivateChatService privateChatService;

    @Autowired
    private ChatMessageCommandService chatMessageCommandService;

    @Autowired
    private MessageReactionService messageReactionService;

    @Autowired
    private ChatRoomManagementService chatRoomManagementService;

    @Autowired
    private ChatRoomEnrichmentService roomEnrichmentService;

    @Test
    void contextLoadsAndWiresRefactoredServices() {
        assertThat(chatService).isNotNull();
        assertThat(privateChatService).isNotNull();
        assertThat(chatMessageCommandService).isNotNull();
        assertThat(messageReactionService).isNotNull();
        assertThat(chatRoomManagementService).isNotNull();
        assertThat(roomEnrichmentService).isNotNull();
    }
}
