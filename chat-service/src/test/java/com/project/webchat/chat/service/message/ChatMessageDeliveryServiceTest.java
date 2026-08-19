package com.project.webchat.chat.service.message;

import com.project.webchat.chat.dto.ChatMessageDTO;
import com.project.webchat.chat.dto.ChatRoomDTO;
import com.project.webchat.chat.entity.ChatMessage;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.ChatType;
import com.project.webchat.chat.entity.MessageType;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.service.MessageEventPublisher;
import com.project.webchat.chat.service.RedisService;
import com.project.webchat.chat.service.WebSocketService;
import com.project.webchat.chat.service.room.ChatRoomQueryService;
import com.project.webchat.chat.service.support.ChatRoomEnricher;
import com.project.webchat.chat.service.support.ChatRoomUpdateNotifier;
import com.project.webchat.chat.service.user.ChatUserInfoService;
import com.project.webchat.chat.service.user.PrivateChatContactRequestService;
import com.project.webchat.shared.dto.UserInfoDTO;
import com.project.webchat.shared.events.v1.MessageCreatedEventV1;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests the outbound pipeline in isolation: Kafka push eligibility + WebSocket fan-out.
 * This is the wished-for seam extracted from ChatMessageCommandService.
 */
@ExtendWith(MockitoExtension.class)
class ChatMessageDeliveryServiceTest {

    private static final String CHAT_ID = "chat-1";
    private static final String MESSAGE_ID = "msg-1";
    private static final Long SENDER_ID = 10L;
    private static final Long OTHER_MEMBER_ID = 20L;
    private static final Long THIRD_MEMBER_ID = 30L;

    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private ChatMessageRepository chatMessageRepository;
    @Mock private RedisService redisService;
    @Mock private WebSocketService webSocketService;
    @Mock private MessageEventPublisher messageEventPublisher;
    @Mock private ChatUserInfoService chatUserInfoService;
    @Mock private ChatRoomEnricher roomEnricher;
    @Mock private ChatRoomUpdateNotifier roomUpdateNotifier;
    @Mock private PrivateChatContactRequestService privateChatContactRequestService;
    @Mock private ChatRoomQueryService chatRoomQueryService;

    @InjectMocks
    private ChatMessageDeliveryService deliveryService;

    private ChatRoom groupRoom;
    private ChatMessage savedMessage;
    private ChatMessageDTO messageDto;

    @BeforeEach
    void setUp() {
        groupRoom = ChatRoom.builder()
                .id(CHAT_ID)
                .type(ChatType.GROUP)
                .memberIds(new HashSet<>(Set.of(SENDER_ID, OTHER_MEMBER_ID, THIRD_MEMBER_ID)))
                .build();
        savedMessage = ChatMessage.builder()
                .id(MESSAGE_ID)
                .chatId(CHAT_ID)
                .senderId(SENDER_ID)
                .senderName("Alice")
                .messageType(MessageType.TEXT)
                .content("hello")
                .build();
        messageDto = ChatMessageDTO.builder()
                .id(MESSAGE_ID)
                .chatId(CHAT_ID)
                .content("hello")
                .build();
        // Default: treat as first message so delivery passes count into the contact hook.
        org.mockito.Mockito.lenient().when(chatMessageRepository.countByChatId(CHAT_ID)).thenReturn(1L);
    }

    @Test
    void notifyMessageCreated_publishesPushForOfflineRecipientsAndDeliversWebsocket() {
        // Arrange: happy path - sender + 2 other members; both others are offline so they need web push
        // Kafka publish reloads the room from the repo to read current memberIds
        when(chatRoomRepository.findById(CHAT_ID)).thenReturn(Optional.of(groupRoom));
        // Offline - shouldSkipPush - returns false - both members stay in recipientUserIds
        when(redisService.isUserOnline(OTHER_MEMBER_ID)).thenReturn(false);
        when(redisService.isUserOnline(THIRD_MEMBER_ID)).thenReturn(false);
        // Sender profile is copied onto the Kafka event (avatar for push UI)
        when(chatUserInfoService.getUserInfo(SENDER_ID)).thenReturn(UserInfoDTO.builder()
                .id(SENDER_ID)
                .username("alice")
                .profilePicture("avatar.png")
                .build());
        // WS "incoming" path builds a personalized sidebar DTO per recipient (unread + enrich)
        when(roomEnricher.getUnreadCount(CHAT_ID, OTHER_MEMBER_ID)).thenReturn(2);
        when(roomEnricher.getUnreadCount(CHAT_ID, THIRD_MEMBER_ID)).thenReturn(1);
        when(roomEnricher.enrichChatWithUserData(eq(groupRoom), eq(OTHER_MEMBER_ID), eq(2)))
                .thenReturn(ChatRoomDTO.builder().id(CHAT_ID).unreadCount(2).build());
        when(roomEnricher.enrichChatWithUserData(eq(groupRoom), eq(THIRD_MEMBER_ID), eq(1)))
                .thenReturn(ChatRoomDTO.builder().id(CHAT_ID).unreadCount(1).build());
        when(chatMessageRepository.countByChatId(CHAT_ID)).thenReturn(1L);

        // Act: one call = Kafka push eligibility + full WebSocket / sidebar fan-out
        deliveryService.notifyMessageCreated(groupRoom, SENDER_ID, savedMessage, messageDto, "hello");

        // Assert — Kafka: event published for both offline recipients (sender excluded)
        ArgumentCaptor<MessageCreatedEventV1> event = ArgumentCaptor.forClass(MessageCreatedEventV1.class);
        verify(messageEventPublisher).publishMessageCreated(event.capture());
        assertThat(event.getValue().getMessageId()).isEqualTo(MESSAGE_ID);
        assertThat(event.getValue().getRecipientUserIds())
                .containsExactlyInAnyOrder(OTHER_MEMBER_ID, THIRD_MEMBER_ID);
        assertThat(event.getValue().getSenderAvatarUrl()).isEqualTo("avatar.png");

        // Assert — WebSocket / side effects after persist:
        // contact-request hook receives message count
        // broadcast message to chat topic, mark sender present in chat,
        // refresh every member's sidebar, then per-member "incoming" inbox notify
        verify(privateChatContactRequestService).maybeCreateContactRequestForPrivateMessage(groupRoom, SENDER_ID, 1L);
        verify(webSocketService).sendMessageToChat(CHAT_ID, messageDto);
        verify(webSocketService).notifyUserJoinedChat(CHAT_ID, SENDER_ID);
        verify(roomUpdateNotifier).notifyRoomMembersChatUpdated(groupRoom);
        verify(webSocketService).notifyIncomingChatMessage(
                eq(OTHER_MEMBER_ID), any(ChatRoomDTO.class), eq(messageDto));
        verify(webSocketService).notifyIncomingChatMessage(
                eq(THIRD_MEMBER_ID), any(ChatRoomDTO.class), eq(messageDto));
        // After fan-out, un-hide the chat for members who used "delete for me".
        verify(chatRoomQueryService).revealChatOnNewMessage(CHAT_ID);
    }

    @Test
    void notifyMessageCreated_skipsPushWhenRecipientIsActivelyViewingChat() {
        when(chatRoomRepository.findById(CHAT_ID)).thenReturn(Optional.of(groupRoom));
        // OTHER is online, not AFK, currently in this chat → no push
        when(redisService.isUserOnline(OTHER_MEMBER_ID)).thenReturn(true);
        when(redisService.isUserAfk(OTHER_MEMBER_ID)).thenReturn(false);
        when(redisService.getCurrentChat(OTHER_MEMBER_ID)).thenReturn(CHAT_ID);
        // THIRD is offline → still gets push
        when(redisService.isUserOnline(THIRD_MEMBER_ID)).thenReturn(false);
        when(chatUserInfoService.getUserInfo(SENDER_ID)).thenReturn(UserInfoDTO.builder()
                .id(SENDER_ID)
                .username("alice")
                .build());
        when(roomEnricher.getUnreadCount(any(), any())).thenReturn(0);
        when(roomEnricher.enrichChatWithUserData(any(), any(), any(Integer.class)))
                .thenReturn(ChatRoomDTO.builder().id(CHAT_ID).build());

        deliveryService.notifyMessageCreated(groupRoom, SENDER_ID, savedMessage, messageDto, "hello");

        ArgumentCaptor<MessageCreatedEventV1> event = ArgumentCaptor.forClass(MessageCreatedEventV1.class);
        verify(messageEventPublisher).publishMessageCreated(event.capture());
        assertThat(event.getValue().getRecipientUserIds()).containsExactly(THIRD_MEMBER_ID);
    }

    @Test
    void notifyMessageCreated_skipsKafkaWhenEveryRecipientIsViewingChat() {
        ChatRoom twoMemberRoom = ChatRoom.builder()
                .id(CHAT_ID)
                .type(ChatType.GROUP)
                .memberIds(new HashSet<>(Set.of(SENDER_ID, OTHER_MEMBER_ID)))
                .build();
        when(chatRoomRepository.findById(CHAT_ID)).thenReturn(Optional.of(twoMemberRoom));
        when(redisService.isUserOnline(OTHER_MEMBER_ID)).thenReturn(true);
        when(redisService.isUserAfk(OTHER_MEMBER_ID)).thenReturn(false);
        when(redisService.getCurrentChat(OTHER_MEMBER_ID)).thenReturn(CHAT_ID);
        when(roomEnricher.getUnreadCount(CHAT_ID, OTHER_MEMBER_ID)).thenReturn(0);
        when(roomEnricher.enrichChatWithUserData(eq(twoMemberRoom), eq(OTHER_MEMBER_ID), eq(0)))
                .thenReturn(ChatRoomDTO.builder().id(CHAT_ID).build());

        deliveryService.notifyMessageCreated(twoMemberRoom, SENDER_ID, savedMessage, messageDto, "hello");

        verify(messageEventPublisher, never()).publishMessageCreated(any());
        // WebSocket delivery still happens for in-app UX
        verify(webSocketService).sendMessageToChat(CHAT_ID, messageDto);
        verify(webSocketService).notifyIncomingChatMessage(
                eq(OTHER_MEMBER_ID), any(ChatRoomDTO.class), eq(messageDto));
    }

    @Test
    void notifyMessageCreated_stillSendsPushWhenViewerIsAfk() {
        ChatRoom twoMemberRoom = ChatRoom.builder()
                .id(CHAT_ID)
                .type(ChatType.GROUP)
                .memberIds(new HashSet<>(Set.of(SENDER_ID, OTHER_MEMBER_ID)))
                .build();
        when(chatRoomRepository.findById(CHAT_ID)).thenReturn(Optional.of(twoMemberRoom));
        when(redisService.isUserOnline(OTHER_MEMBER_ID)).thenReturn(true);
        when(redisService.isUserAfk(OTHER_MEMBER_ID)).thenReturn(true);
        when(chatUserInfoService.getUserInfo(SENDER_ID)).thenReturn(UserInfoDTO.builder()
                .id(SENDER_ID)
                .username("alice")
                .build());
        when(roomEnricher.getUnreadCount(CHAT_ID, OTHER_MEMBER_ID)).thenReturn(1);
        when(roomEnricher.enrichChatWithUserData(eq(twoMemberRoom), eq(OTHER_MEMBER_ID), eq(1)))
                .thenReturn(ChatRoomDTO.builder().id(CHAT_ID).build());

        deliveryService.notifyMessageCreated(twoMemberRoom, SENDER_ID, savedMessage, messageDto, "hello");

        ArgumentCaptor<MessageCreatedEventV1> event = ArgumentCaptor.forClass(MessageCreatedEventV1.class);
        verify(messageEventPublisher).publishMessageCreated(event.capture());
        assertThat(event.getValue().getRecipientUserIds()).containsExactly(OTHER_MEMBER_ID);
    }

    @Test
    void notifyMessageCreated_withNullRoom_fallsBackToWebsocketBroadcastOnly() {
        // Defensive path: no persisted message to publish, no room for fan-out — still broadcast DTO.
        deliveryService.notifyMessageCreated(null, SENDER_ID, null, messageDto, "hello");

        verify(webSocketService).sendMessageToChat(CHAT_ID, messageDto);
        verify(messageEventPublisher, never()).publishMessageCreated(any());
        verify(chatRoomRepository, never()).findById(any());
        verify(privateChatContactRequestService, never())
                .maybeCreateContactRequestForPrivateMessage(any(), any(), org.mockito.ArgumentMatchers.anyLong());
        // Still reveal by chatId from the DTO so hidden chats reappear on activity.
        verify(chatRoomQueryService).revealChatOnNewMessage(CHAT_ID);
    }

    @Test
    void notifyMessageEdited_forwardsToWebsocket() {
        LocalDateTime editedAt = LocalDateTime.of(2026, 8, 13, 12, 0);
        Set<Long> members = Set.of(SENDER_ID, OTHER_MEMBER_ID);

        deliveryService.notifyMessageEdited(
                MESSAGE_ID, CHAT_ID, "edited", SENDER_ID, editedAt, MessageType.TEXT, members);

        verify(webSocketService).notifyMessageEdited(
                MESSAGE_ID, CHAT_ID, "edited", SENDER_ID, editedAt, MessageType.TEXT, members);
    }

    @Test
    void notifyMessageDeleted_forwardsToWebsocket() {
        Set<Long> members = Set.of(SENDER_ID, OTHER_MEMBER_ID);

        deliveryService.notifyMessageDeleted(MESSAGE_ID, CHAT_ID, SENDER_ID, members);

        verify(webSocketService).notifyMessageDeleted(MESSAGE_ID, CHAT_ID, SENDER_ID, members);
    }

    @Test
    void notifyReaderPresent_forwardsJoinPresence() {
        deliveryService.notifyReaderPresent(CHAT_ID, OTHER_MEMBER_ID);

        verify(webSocketService).notifyUserJoinedChat(CHAT_ID, OTHER_MEMBER_ID);
    }

    @Test
    void notifyReadReceipt_forwardsReadIds() {
        List<String> readIds = List.of("m1", "m2");

        deliveryService.notifyReadReceipt(CHAT_ID, OTHER_MEMBER_ID, readIds);

        verify(webSocketService).sendReadReceipt(CHAT_ID, OTHER_MEMBER_ID, readIds);
    }
}
