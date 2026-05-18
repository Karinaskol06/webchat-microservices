package com.project.webchat.chat.service.message;

import com.project.webchat.chat.dto.MessageReactionDTO;
import com.project.webchat.chat.entity.ChatMessage;
import com.project.webchat.chat.entity.ChatRoom;
import com.project.webchat.chat.entity.MessageReaction;
import com.project.webchat.chat.entity.MessageType;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.repository.ChatRoomRepository;
import com.project.webchat.chat.service.WebSocketService;
import com.project.webchat.chat.service.support.ChatMessageMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MessageReactionServiceTest {

    @Mock
    private ChatMessageRepository chatMessageRepository;
    @Mock
    private ChatRoomRepository chatRoomRepository;
    @Mock
    private WebSocketService webSocketService;
    @Mock
    private ChatMessageMapper chatMessageMapper;

    @InjectMocks
    private MessageReactionService messageReactionService;

    private static final String CHAT_ID = "chat-1";
    private static final String MESSAGE_ID = "msg-1";
    private static final Long USER_ID = 10L;

    private ChatMessage message;

    @BeforeEach
    void setUp() {
        message = ChatMessage.builder()
                .id(MESSAGE_ID)
                .chatId(CHAT_ID)
                .senderId(20L)
                .messageType(MessageType.TEXT)
                .content("hello")
                .reactions(new ArrayList<>())
                .build();
    }

    @Test
    void toggleMessageReaction_addsAndRemovesEmoji() {
        when(chatMessageRepository.findById(MESSAGE_ID)).thenReturn(Optional.of(message));
        when(chatRoomRepository.existsByIdAndMemberIdsContains(CHAT_ID, USER_ID)).thenReturn(true);
        when(chatMessageRepository.save(any(ChatMessage.class))).thenAnswer(inv -> inv.getArgument(0));
        when(chatMessageMapper.toReactionDtos(any(), org.mockito.ArgumentMatchers.eq(USER_ID)))
                .thenAnswer(inv -> {
                    List<MessageReaction> reactions = inv.getArgument(0);
                    if (reactions == null || reactions.isEmpty()) {
                        return List.of();
                    }
                    return List.of(MessageReactionDTO.builder()
                            .emoji(reactions.get(0).getEmoji())
                            .reactedByMe(true)
                            .build());
                });

        List<MessageReactionDTO> added = messageReactionService.toggleMessageReaction(CHAT_ID, MESSAGE_ID, USER_ID, "👍");
        assertThat(added).hasSize(1);
        assertThat(added.get(0).getEmoji()).isEqualTo("👍");

        message.setReactions(new ArrayList<>(List.of(
                MessageReaction.builder().emoji("👍").userIds(new ArrayList<>(List.of(USER_ID))).build()
        )));
        when(chatMessageMapper.toReactionDtos(any(), org.mockito.ArgumentMatchers.eq(USER_ID)))
                .thenReturn(List.of());

        List<MessageReactionDTO> removed = messageReactionService.toggleMessageReaction(CHAT_ID, MESSAGE_ID, USER_ID, "👍");
        assertThat(removed).isEmpty();

        ArgumentCaptor<ChatMessage> captor = ArgumentCaptor.forClass(ChatMessage.class);
        verify(chatMessageRepository, org.mockito.Mockito.atLeastOnce()).save(captor.capture());
        assertThat(captor.getValue().getReactions()).isEmpty();
    }

    @Test
    void toggleMessageReaction_enforcesMaxFivePerUser() {
        message.setReactions(new ArrayList<>(List.of(
                reaction("❤️", USER_ID),
                reaction("👍", USER_ID),
                reaction("😍", USER_ID),
                reaction("😊", USER_ID),
                reaction("😭", USER_ID)
        )));
        when(chatMessageRepository.findById(MESSAGE_ID)).thenReturn(Optional.of(message));
        when(chatRoomRepository.existsByIdAndMemberIdsContains(CHAT_ID, USER_ID)).thenReturn(true);

        assertThatThrownBy(() -> messageReactionService.toggleMessageReaction(CHAT_ID, MESSAGE_ID, USER_ID, "🙄"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("5");
    }

    @Test
    void normalizeReactionEmoji_rejectsBlank() {
        assertThatThrownBy(() -> MessageReactionService.normalizeReactionEmoji("  "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Emoji is required");
    }

    private static MessageReaction reaction(String emoji, Long userId) {
        return MessageReaction.builder()
                .emoji(emoji)
                .userIds(new ArrayList<>(List.of(userId)))
                .build();
    }
}
