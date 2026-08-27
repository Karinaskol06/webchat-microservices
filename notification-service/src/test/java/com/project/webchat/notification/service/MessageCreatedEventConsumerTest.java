package com.project.webchat.notification.service;

import com.project.webchat.shared.events.v1.MessageCreatedEventV1;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.support.Acknowledgment;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.function.ToIntFunction;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MessageCreatedEventConsumerTest {

    @Mock
    private WebPushDeliveryOrchestrator webPushDeliveryOrchestrator;

    @Mock
    private WebPushService webPushService;

    @Mock
    private Acknowledgment acknowledgment;

    @InjectMocks
    private MessageCreatedEventConsumer consumer;

    @Test
    void consumeMessageCreated_rejectsInvalidPayload() {
        assertThatThrownBy(() -> consumer.consumeMessageCreated(null, acknowledgment))
                .isInstanceOf(IllegalArgumentException.class);

        verify(webPushDeliveryOrchestrator, never()).deliverToRecipients(any(), any(), any(), any());
        verify(acknowledgment, never()).acknowledge();
    }

    @Test
    void consumeMessageCreated_deliversAndAcknowledges() {
        UUID eventId = UUID.randomUUID();
        MessageCreatedEventV1 event = MessageCreatedEventV1.builder()
                .eventId(eventId)
                .occurredAt(Instant.now())
                .schemaVersion(MessageCreatedEventV1.SCHEMA_VERSION_V1)
                .chatId("chat-1")
                .messageId("msg-1")
                .senderId(10L)
                .recipientUserIds(List.of(20L, 30L))
                .previewText("hello")
                .messageType("TEXT")
                .build();

        when(webPushService.sendMessageCreated(eq(20L), eq(event))).thenReturn(1);
        when(webPushService.sendMessageCreated(eq(30L), eq(event))).thenReturn(0);

        consumer.consumeMessageCreated(event, acknowledgment);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<ToIntFunction<Long>> senderCaptor = ArgumentCaptor.forClass(ToIntFunction.class);
        verify(webPushDeliveryOrchestrator).deliverToRecipients(
                eq(eventId),
                eq(List.of(20L, 30L)),
                eq("message-created"),
                senderCaptor.capture());

        ToIntFunction<Long> sender = senderCaptor.getValue();
        assertThat(sender.applyAsInt(20L)).isEqualTo(1);
        assertThat(sender.applyAsInt(30L)).isEqualTo(0);

        verify(acknowledgment).acknowledge();
    }
}
