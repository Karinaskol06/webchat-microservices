package com.project.webchat.chat.service.message;

import com.project.webchat.chat.dto.ChatMessageDTO;
import com.project.webchat.chat.dto.SendMessageRequest;
import com.project.webchat.chat.entity.ChatMessage;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.entity.MessageType;
import com.project.webchat.chat.exception.ForbiddenChatOperationException;
import com.project.webchat.chat.repository.AttachmentRepository;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.FileStorageService;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.support.ChatMessageMapper;
import com.project.webchat.chat.service.support.ChatMessagePreviewHelper;
import com.project.webchat.chat.service.support.ChatRoomUpdateNotifier;
import com.project.webchat.chat.service.support.ChatRoomPermissionService;
import com.project.webchat.chat.service.support.PersonalSpacePayloadValidator;
import com.project.webchat.chat.service.support.PollPayloadHelper;
import com.project.webchat.chat.service.support.SharedPollService;
import com.project.webchat.chat.service.support.UserBanGuardService;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import com.project.webchat.shared.dto.UserInfoDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Command-service tests focus on validate → persist → map.
 * Outbound Kafka/WebSocket policy lives in {@link ChatMessageDeliveryServiceTest}.
 */
@ExtendWith(MockitoExtension.class)
class ChatMessageCommandServiceTest {

    private static final String CHAT_ID = "chat-1";
    private static final String MESSAGE_ID = "msg-1";
    private static final Long SENDER_ID = 10L;
    private static final Long OTHER_MEMBER_ID = 20L;
    private static final Long OUTSIDER_ID = 99L;

    @Mock private ChatMessageRepository chatMessageRepository;
    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private AttachmentRepository attachmentRepository;
    @Mock private RedisService redisService;
    @Mock private FileStorageService fileStorageService;
    @Mock private ChatUserInfoService chatUserInfoService;
    @Mock private ChatMessageMapper chatMessageMapper;
    @Mock private ChatMessagePreviewHelper previewHelper;
    @Mock private ChatRoomPermissionService roomPermissionService;
    @Mock private ChatRoomUpdateNotifier roomUpdateNotifier;
    @Mock private PersonalSpacePayloadValidator personalSpacePayloadValidator;
    @Mock private PollPayloadHelper pollPayloadHelper;
    @Mock private SharedPollService sharedPollService;
    @Mock private UserBanGuardService userBanGuardService;
    @Mock private ChatMessageDeliveryService messageDeliveryService;

    @InjectMocks
    private ChatMessageCommandService service;

    private ChatRoom groupRoom;
    private UserInfoDTO senderInfo;

    @BeforeEach
    void setUp() {
        groupRoom = groupRoom(CHAT_ID, Set.of(SENDER_ID, OTHER_MEMBER_ID));
        senderInfo = UserInfoDTO.builder()
                .id(SENDER_ID)
                .username("alice")
                .firstName("Alice")
                .lastName("Smith")
                .build();
    }

    @Test
    void sendMessage_member_persistsAndHandsOffToDelivery() {
        when(chatRoomRepository.findById(CHAT_ID)).thenReturn(Optional.of(groupRoom));
        doNothing().when(roomPermissionService).assertCanPostMessage(groupRoom, SENDER_ID);
        when(chatUserInfoService.getUserInfo(SENDER_ID)).thenReturn(senderInfo);
        when(chatMessageMapper.normalizeReplyToMessageId(any())).thenReturn(null);
        when(chatMessageRepository.save(any(ChatMessage.class))).thenAnswer(inv -> {
            ChatMessage msg = inv.getArgument(0);
            msg.setId(MESSAGE_ID);
            return msg;
        });
        when(previewHelper.getPreviewText(anyString(), anyList())).thenReturn("hello");
        ChatMessageDTO dto = ChatMessageDTO.builder()
                .id(MESSAGE_ID)
                .chatId(CHAT_ID)
                .content("hello")
                .sender(senderInfo)
                .build();
        when(chatMessageMapper.toMessageDTO(any(ChatMessage.class), eq(senderInfo))).thenReturn(dto);
        when(chatRoomRepository.save(any(ChatRoom.class))).thenAnswer(inv -> inv.getArgument(0));

        ChatMessageDTO result = service.sendMessage(SENDER_ID, SendMessageRequest.builder()
                .chatId(CHAT_ID)
                .content("hello")
                .type(MessageType.TEXT)
                .build());

        assertThat(result.getId()).isEqualTo(MESSAGE_ID);
        assertThat(result.getContent()).isEqualTo("hello");

        ArgumentCaptor<ChatMessage> saved = ArgumentCaptor.forClass(ChatMessage.class);
        verify(chatMessageRepository).save(saved.capture());
        assertThat(saved.getValue().getSenderId()).isEqualTo(SENDER_ID);
        assertThat(saved.getValue().getContent()).isEqualTo("hello");

        verify(redisService).updatePresence(SENDER_ID, CHAT_ID);
        verify(messageDeliveryService).notifyMessageCreated(
                eq(groupRoom), eq(SENDER_ID), any(ChatMessage.class), eq(dto), eq("hello"));
    }

    @Test
    void sendMessage_nonMember_deniedWithoutPersistOrDelivery() {
        ChatRoom outsidersOnly = groupRoom(CHAT_ID, Set.of(OTHER_MEMBER_ID));
        when(chatRoomRepository.findById(CHAT_ID)).thenReturn(Optional.of(outsidersOnly));

        assertThatThrownBy(() -> service.sendMessage(SENDER_ID, SendMessageRequest.builder()
                .chatId(CHAT_ID)
                .content("hello")
                .type(MessageType.TEXT)
                .build()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("User is not a member of this chat.");

        verify(chatMessageRepository, never()).save(any());
        verify(messageDeliveryService, never()).notifyMessageCreated(any(), any(), any(), any(), any());
    }

    @Test
    void sendMessage_channelWithoutPostPermission_denied() {
        when(chatRoomRepository.findById(CHAT_ID)).thenReturn(Optional.of(groupRoom));
        doThrow(new ForbiddenChatOperationException("You do not have permission to post in this channel."))
                .when(roomPermissionService).assertCanPostMessage(groupRoom, SENDER_ID);

        assertThatThrownBy(() -> service.sendMessage(SENDER_ID, SendMessageRequest.builder()
                .chatId(CHAT_ID)
                .content("hello")
                .type(MessageType.TEXT)
                .build()))
                .isInstanceOf(ForbiddenChatOperationException.class)
                .hasMessage("You do not have permission to post in this channel.");

        verify(chatMessageRepository, never()).save(any());
        verify(messageDeliveryService, never()).notifyMessageCreated(any(), any(), any(), any(), any());
    }

    @Test
    void editMessage_withoutPermission_throwsForbidden() {
        ChatMessage message = textMessage(MESSAGE_ID, CHAT_ID, SENDER_ID, "original");
        when(chatMessageRepository.findById(MESSAGE_ID)).thenReturn(Optional.of(message));
        when(chatRoomRepository.findById(CHAT_ID)).thenReturn(Optional.of(groupRoom));
        when(roomPermissionService.canEditOrDeleteMessage(groupRoom, OUTSIDER_ID, SENDER_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.editMessage(MESSAGE_ID, OUTSIDER_ID, "hacked"))
                .isInstanceOf(ForbiddenChatOperationException.class)
                .hasMessage("You cannot edit this message");

        verify(chatMessageRepository, never()).save(any());
        verify(messageDeliveryService, never()).notifyMessageEdited(
                anyString(), anyString(), any(), any(), any(), any(), any());
    }

    @Test
    void editMessage_author_updatesContentAndNotifies() {
        ChatMessage message = textMessage(MESSAGE_ID, CHAT_ID, SENDER_ID, "original");
        when(chatMessageRepository.findById(MESSAGE_ID)).thenReturn(Optional.of(message));
        when(chatRoomRepository.findById(CHAT_ID)).thenReturn(Optional.of(groupRoom));
        when(roomPermissionService.canEditOrDeleteMessage(groupRoom, SENDER_ID, SENDER_ID)).thenReturn(true);
        when(attachmentRepository.findByMessageId(MESSAGE_ID)).thenReturn(List.of());
        when(chatMessageRepository.save(any(ChatMessage.class))).thenAnswer(inv -> inv.getArgument(0));
        when(chatUserInfoService.getUserInfo(SENDER_ID)).thenReturn(senderInfo);
        ChatMessageDTO dto = ChatMessageDTO.builder().id(MESSAGE_ID).content("edited").build();
        when(chatMessageMapper.toMessageDTO(any(ChatMessage.class), eq(senderInfo), eq(SENDER_ID))).thenReturn(dto);

        ChatMessageDTO result = service.editMessage(MESSAGE_ID, SENDER_ID, "edited");

        assertThat(result.getContent()).isEqualTo("edited");
        assertThat(message.getContent()).isEqualTo("edited");
        assertThat(message.getEditedAt()).isNotNull();
        verify(messageDeliveryService).notifyMessageEdited(
                eq(MESSAGE_ID), eq(CHAT_ID), eq("edited"), eq(SENDER_ID), any(), eq(MessageType.TEXT), any());
    }

    @Test
    void deleteMessage_withoutPermission_throwsForbidden() {
        ChatMessage message = textMessage(MESSAGE_ID, CHAT_ID, SENDER_ID, "bye");
        when(chatMessageRepository.findById(MESSAGE_ID)).thenReturn(Optional.of(message));
        when(chatRoomRepository.findById(CHAT_ID)).thenReturn(Optional.of(groupRoom));
        when(roomPermissionService.canEditOrDeleteMessage(groupRoom, OUTSIDER_ID, SENDER_ID)).thenReturn(false);

        assertThatThrownBy(() -> service.deleteMessage(MESSAGE_ID, OUTSIDER_ID))
                .isInstanceOf(ForbiddenChatOperationException.class)
                .hasMessage("You cannot delete this message");

        verify(chatMessageRepository, never()).delete(any());
        verify(messageDeliveryService, never()).notifyMessageDeleted(anyString(), anyString(), any(), any());
    }

    @Test
    void deleteMessage_author_deletesAndNotifies() {
        ChatMessage message = textMessage(MESSAGE_ID, CHAT_ID, SENDER_ID, "bye");
        when(chatMessageRepository.findById(MESSAGE_ID)).thenReturn(Optional.of(message));
        when(chatRoomRepository.findById(CHAT_ID)).thenReturn(Optional.of(groupRoom));
        when(roomPermissionService.canEditOrDeleteMessage(groupRoom, SENDER_ID, SENDER_ID)).thenReturn(true);
        when(attachmentRepository.findByMessageId(MESSAGE_ID)).thenReturn(List.of());
        lenient().when(chatMessageRepository.findTopByChatIdOrderByTimestampDesc(CHAT_ID))
                .thenReturn(Optional.empty());
        lenient().when(chatRoomRepository.save(any(ChatRoom.class))).thenAnswer(inv -> inv.getArgument(0));

        service.deleteMessage(MESSAGE_ID, SENDER_ID);

        verify(chatMessageRepository).delete(message);
        verify(messageDeliveryService).notifyMessageDeleted(
                MESSAGE_ID, CHAT_ID, SENDER_ID, groupRoom.getMemberIds());
    }

    private static ChatRoom groupRoom(String id, Set<Long> members) {
        return ChatRoom.builder()
                .id(id)
                .type(ChatType.GROUP)
                .memberIds(new HashSet<>(members))
                .build();
    }

    private static ChatMessage textMessage(String id, String chatId, Long senderId, String content) {
        return ChatMessage.builder()
                .id(id)
                .chatId(chatId)
                .senderId(senderId)
                .messageType(MessageType.TEXT)
                .content(content)
                .build();
    }
}
