package com.project.webchat.notification.service;

import com.project.webchat.notification.entity.DeliveryChannel;
import com.project.webchat.notification.entity.DeliveryStatus;
import com.project.webchat.notification.entity.NotificationDelivery;
import com.project.webchat.notification.repository.NotificationDeliveryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import java.util.function.ToIntFunction;

@Service
@RequiredArgsConstructor
@Slf4j
public class WebPushDeliveryOrchestrator {

    private final NotificationDeliveryRepository notificationDeliveryRepository;

    public void deliverToRecipients(UUID eventId,
                                    Collection<Long> recipientUserIds,
                                    String eventKind,
                                    ToIntFunction<Long> pushSender) {
        Set<Long> recipientIds = new LinkedHashSet<>(recipientUserIds);
        for (Long recipientUserId : recipientIds) {
            if (recipientUserId == null) {
                continue;
            }
            NotificationDelivery delivery = notificationDeliveryRepository
                    .findByEventIdAndRecipientUserIdAndChannel(
                            eventId,
                            recipientUserId,
                            DeliveryChannel.WEB_PUSH
                    )
                    .orElseGet(() -> notificationDeliveryRepository.save(NotificationDelivery.builder()
                            .eventId(eventId)
                            .recipientUserId(recipientUserId)
                            .channel(DeliveryChannel.WEB_PUSH)
                            .status(DeliveryStatus.PENDING)
                            .build()));

            if (delivery.getStatus() == DeliveryStatus.SENT) {
                log.info("Skipping already delivered eventId={} recipientUserId={} channel={}",
                        eventId, recipientUserId, DeliveryChannel.WEB_PUSH);
                continue;
            }

            if (delivery.getStatus() == DeliveryStatus.FAILED) {
                log.info("Retrying previously failed delivery eventId={} recipientUserId={} channel={} reason={}",
                        eventId, recipientUserId, DeliveryChannel.WEB_PUSH, delivery.getFailureReason());
            }

            int deliveredCount = pushSender.applyAsInt(recipientUserId);
            if (deliveredCount > 0) {
                delivery.setStatus(DeliveryStatus.SENT);
                delivery.setFailureReason(null);
            } else {
                // Do not mark SENT when nothing was delivered — a later Kafka redelivery
                // (or a new subscription) must be allowed to retry this event.
                delivery.setStatus(DeliveryStatus.FAILED);
                delivery.setFailureReason("no_push_deliveries");
            }
            notificationDeliveryRepository.save(delivery);

            log.info("Processed {} eventId={} recipientUserId={} deliveries={} status={}",
                    eventKind, eventId, recipientUserId, deliveredCount, delivery.getStatus());
        }
    }
}
