package com.project.webchat.chat.service;

import com.project.webchat.chat.dto.BootstrapMessageRequest;
import com.project.webchat.chat.dto.BootstrapMessageResponse;
import com.project.webchat.chat.entity.BootstrapMessageRecord;
import com.project.webchat.chat.entity.ChatMessage;
import com.project.webchat.chat.feign.UserServiceClient;
import com.project.webchat.chat.repository.AttachmentRepository;
import com.project.webchat.chat.repository.BootstrapMessageRecordRepository;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.shared.dto.UserDTO;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatServiceBootstrapTest {

    @Mock
    private ChatMessageRepository chatMessageRepository;
    @Mock
    private ChatRoomRepository chatRoomRepository;
    @Mock
    private AttachmentRepository attachmentRepository;
    @Mock
    private BootstrapMessageRecordRepository bootstrapMessageRecordRepository;
    @Mock
    private RedisService redisService;
    @Mock
    private WebSocketService webSocketService;
    @Mock
    private UserServiceClient userServiceClient;

    @InjectMocks
    private ChatService chatService;

    @Test
    void bootstrapMessageReplaysExistingIdempotentRecord() {
        BootstrapMessageRecord record = BootstrapMessageRecord.builder()
                .senderId(1L)
                .clientRequestKey("req-1")
                .chatId("chat-42")
                .messageId("msg-99")
                .build();
        when(bootstrapMessageRecordRepository.findBySenderIdAndClientRequestKey(1L, "req-1"))
                .thenReturn(Optional.of(record));
        when(chatMessageRepository.findById("msg-99"))
                .thenReturn(Optional.of(ChatMessage.builder()
                        .id("msg-99")
                        .chatId("chat-42")
                        .senderId(1L)
                        .content("hello")
                        .build()));
        when(userServiceClient.getUserById(1L))
                .thenReturn(ResponseEntity.ok(UserDTO.builder().id(1L).username("alice").build()));
        when(redisService.isUserOnline(1L)).thenReturn(false);

        BootstrapMessageRequest request = new BootstrapMessageRequest();
        request.setRecipientUserId(2L);
        request.setContent("hello");
        request.setClientRequestKey("req-1");

        BootstrapMessageResponse response = chatService.bootstrapFirstMessage(1L, request);

        assertThat(response.isIdempotentReplay()).isTrue();
        assertThat(response.getChatId()).isEqualTo("chat-42");
        assertThat(response.getMessage()).isNotNull();
        verify(bootstrapMessageRecordRepository).findBySenderIdAndClientRequestKey(1L, "req-1");
    }

    @Test
    void bootstrapMessageRequiresClientRequestKey() {
        BootstrapMessageRequest request = new BootstrapMessageRequest();
        request.setRecipientUserId(2L);
        request.setContent("hello");
        request.setClientRequestKey("   ");

        assertThatThrownBy(() -> chatService.bootstrapFirstMessage(1L, request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Client request key is required");
    }
}
