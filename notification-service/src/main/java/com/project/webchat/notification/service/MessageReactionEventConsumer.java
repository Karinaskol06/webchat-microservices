package com.project.webchat.notification.service;

import com.project.webchat.shared.events.v1.MessageReactionEventV1;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessageReactionEventConsumer {

    private final WebPushDeliveryOrchestrator webPushDeliveryOrchestrator;
    private final WebPushService webPushService;

    @KafkaListener(
            topics = "${app.kafka.topics.message-reaction}",
            containerFactory = "messageReactionKafkaListenerContainerFactory"
    )
    @Transactional
    public void consumeMessageReaction(MessageReactionEventV1 event, Acknowledgment acknowledgment) {
        if (event == null || event.getEventId() == null || event.getRecipientUserIds() == null) {
            throw new IllegalArgumentException("Invalid message-reaction event payload");
        }
        log.info("Consuming message-reaction eventId={} chatId={} messageId={} reactorId={} recipients={}",
                event.getEventId(), event.getChatId(), event.getMessageId(), event.getReactorUserId(),
                event.getRecipientUserIds());

        webPushDeliveryOrchestrator.deliverToRecipients(
                event.getEventId(),
                event.getRecipientUserIds(),
                "message-reaction",
                recipientUserId -> webPushService.sendMessageReaction(recipientUserId, event)
        );

        acknowledgment.acknowledge();
    }
}
