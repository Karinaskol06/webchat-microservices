package com.project.webchat.chat.service.support;

import com.project.webchat.chat.entity.ChatMessage;
import com.project.webchat.chat.entity.MessageType;
import com.project.webchat.chat.repository.ChatMessageRepository;
import com.project.webchat.chat.service.WebSocketService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SharedPollServiceTest {

    @Mock
    private ChatMessageRepository chatMessageRepository;

    @Mock
    private PollPayloadHelper pollPayloadHelper;

    @Mock
    private WebSocketService webSocketService;

    @InjectMocks
    private SharedPollService sharedPollService;

    @Test
    void prepareForwardPollContent_reusesSharedVotes() {
        String channelContent = """
                {"pollId":"poll-1","question":"Q","mode":"poll",
                "options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],
                "votes":{"9":{"optionIds":["a"],"name":"Voter","completed":true}}}
                """;
        ChatMessage source = ChatMessage.builder()
                .id("src-msg")
                .chatId("channel-1")
                .messageType(MessageType.POLL)
                .content(channelContent)
                .timestamp(LocalDateTime.now())
                .build();

        when(pollPayloadHelper.ensurePollId(channelContent, "src-msg")).thenReturn(channelContent);
        when(pollPayloadHelper.extractPollId(channelContent)).thenReturn("poll-1");
        when(chatMessageRepository.findPollMessagesByPollIdPattern(any())).thenReturn(List.of(source));

        String forwardContent = sharedPollService.prepareForwardPollContent(source);

        assertThat(forwardContent).isEqualTo(channelContent);
        assertThat(forwardContent).contains("\"optionIds\":[\"a\"]");
    }

    @Test
    void propagatePollUpdate_updatesAllLinkedMessages() {
        String updated = """
                {"pollId":"poll-1","question":"Q","mode":"poll",
                "options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],
                "votes":{"1":{"optionIds":["b"],"name":"Bob","completed":true},
                         "2":{"optionIds":["a"],"name":"Ann","completed":true}}}
                """;
        ChatMessage channelCopy = ChatMessage.builder()
                .id("m1")
                .chatId("channel-1")
                .messageType(MessageType.POLL)
                .content("{}")
                .build();
        ChatMessage groupCopy = ChatMessage.builder()
                .id("m2")
                .chatId("group-1")
                .messageType(MessageType.POLL)
                .content("{}")
                .build();

        when(chatMessageRepository.findPollMessagesByPollIdPattern(any()))
                .thenReturn(List.of(channelCopy, groupCopy));
        when(chatMessageRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        sharedPollService.propagatePollUpdate("poll-1", updated, 2L);

        ArgumentCaptor<ChatMessage> saved = ArgumentCaptor.forClass(ChatMessage.class);
        verify(chatMessageRepository, atLeastOnce()).save(saved.capture());
        assertThat(saved.getAllValues()).allMatch(m -> updated.equals(m.getContent()));
        verify(webSocketService, atLeastOnce()).notifyMessageEdited(
                eq("m1"), eq("channel-1"), eq(updated), eq(2L), eq(null), eq(MessageType.POLL));
        verify(webSocketService, atLeastOnce()).notifyMessageEdited(
                eq("m2"), eq("group-1"), eq(updated), eq(2L), eq(null), eq(MessageType.POLL));
    }
}
