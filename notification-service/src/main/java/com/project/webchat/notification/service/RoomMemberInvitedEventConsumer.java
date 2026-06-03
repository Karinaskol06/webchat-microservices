package com.project.webchat.notification.service;

import com.project.webchat.shared.events.v1.RoomMemberInvitedEventV1;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class RoomMemberInvitedEventConsumer {

    private final WebPushDeliveryOrchestrator webPushDeliveryOrchestrator;
    private final WebPushService webPushService;

    @KafkaListener(
            topics = "${app.kafka.topics.room-member-invited}",
            containerFactory = "roomMemberInvitedKafkaListenerContainerFactory"
    )
    @Transactional
    public void consumeRoomMemberInvited(RoomMemberInvitedEventV1 event, Acknowledgment acknowledgment) {
        if (event == null || event.getEventId() == null || event.getInviteeUserId() == null) {
            throw new IllegalArgumentException("Invalid room-member-invited event payload");
        }
        log.info("Consuming room-member-invited eventId={} roomId={} inviteId={} inviteeUserId={}",
                event.getEventId(), event.getRoomId(), event.getInviteId(), event.getInviteeUserId());

        webPushDeliveryOrchestrator.deliverToRecipients(
                event.getEventId(),
                List.of(event.getInviteeUserId()),
                "room-member-invited",
                recipientUserId -> webPushService.sendRoomMemberInvited(recipientUserId, event)
        );

        acknowledgment.acknowledge();
    }
}
