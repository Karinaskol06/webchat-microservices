package com.project.webchat.notification.service;

import com.project.webchat.shared.events.v1.MessageCreatedEventV1;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessageCreatedEventConsumer {

    private final WebPushDeliveryOrchestrator webPushDeliveryOrchestrator;
    private final WebPushService webPushService;

    @KafkaListener(
            topics = "${app.kafka.topics.message-created}",
            containerFactory = "messageCreatedKafkaListenerContainerFactory"
    )
    @Transactional
    public void consumeMessageCreated(MessageCreatedEventV1 event, Acknowledgment acknowledgment) {
        if (event == null || event.getEventId() == null || event.getRecipientUserIds() == null) {
            throw new IllegalArgumentException("Invalid message-created event payload");
        }
        log.info("Consuming message-created eventId={} chatId={} messageId={} senderId={} recipients={}",
                event.getEventId(), event.getChatId(), event.getMessageId(), event.getSenderId(), event.getRecipientUserIds());

        webPushDeliveryOrchestrator.deliverToRecipients(
                event.getEventId(),
                event.getRecipientUserIds(),
                "message-created",
                recipientUserId -> webPushService.sendMessageCreated(recipientUserId, event)
        );

        acknowledgment.acknowledge();
    }
}
