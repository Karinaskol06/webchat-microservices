package com.project.webchat.notification.service;

import com.project.webchat.notification.entity.DeliveryChannel;
import com.project.webchat.notification.entity.DeliveryStatus;
import com.project.webchat.notification.entity.NotificationDelivery;
import com.project.webchat.notification.repository.NotificationDeliveryRepository;
import com.project.webchat.shared.events.v1.MessageCreatedEventV1;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessageCreatedEventConsumer {

    private final NotificationDeliveryRepository notificationDeliveryRepository;
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

        Set<Long> recipientIds = new LinkedHashSet<>(event.getRecipientUserIds());
        for (Long recipientUserId : recipientIds) {
            if (recipientUserId == null) {
                continue;
            }
            NotificationDelivery delivery = notificationDeliveryRepository
                    .findByEventIdAndRecipientUserIdAndChannel(
                            event.getEventId(),
                            recipientUserId,
                            DeliveryChannel.WEB_PUSH
                    )
                    .orElseGet(() -> notificationDeliveryRepository.save(NotificationDelivery.builder()
                            .eventId(event.getEventId())
                            .recipientUserId(recipientUserId)
                            .channel(DeliveryChannel.WEB_PUSH)
                            .status(DeliveryStatus.PENDING)
                            .build()));

            if (delivery.getStatus() == DeliveryStatus.SENT) {
                log.info("Skipping already delivered eventId={} recipientUserId={} channel={}",
                        event.getEventId(), recipientUserId, DeliveryChannel.WEB_PUSH);
                continue;
            }

            int deliveredCount = webPushService.sendMessageCreated(recipientUserId, event);
            delivery.setStatus(DeliveryStatus.SENT);
            delivery.setFailureReason(deliveredCount == 0 ? "no_active_subscriptions" : null);
            notificationDeliveryRepository.save(delivery);

            log.info("Processed message-created eventId={} chatId={} messageId={} recipientUserId={} deliveries={}",
                    event.getEventId(), event.getChatId(), event.getMessageId(), recipientUserId, deliveredCount);
        }

        acknowledgment.acknowledge();
    }
}
