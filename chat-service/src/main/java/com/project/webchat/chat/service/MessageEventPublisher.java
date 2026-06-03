package com.project.webchat.chat.service;

import com.project.webchat.shared.events.v1.MessageCreatedEventV1;
import com.project.webchat.shared.events.v1.MessageReactionEventV1;
import com.project.webchat.shared.events.v1.RoomMemberInvitedEventV1;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class MessageEventPublisher {

    private final KafkaTemplate<String, MessageCreatedEventV1> messageCreatedKafkaTemplate;
    private final KafkaTemplate<String, MessageReactionEventV1> messageReactionKafkaTemplate;
    private final KafkaTemplate<String, RoomMemberInvitedEventV1> roomMemberInvitedKafkaTemplate;

    @Value("${app.kafka.topics.message-created:chat.message.created.v1}")
    private String messageCreatedTopic;

    @Value("${app.kafka.topics.message-reaction:chat.message.reaction.v1}")
    private String messageReactionTopic;

    @Value("${app.kafka.topics.room-member-invited:chat.room.member.invited.v1}")
    private String roomMemberInvitedTopic;

    public void publishMessageCreated(MessageCreatedEventV1 event) {
        log.info("Publishing message-created eventId={} chatId={} messageId={} recipients={} topic={}",
                event.getEventId(), event.getChatId(), event.getMessageId(), event.getRecipientUserIds(), messageCreatedTopic);
        messageCreatedKafkaTemplate.send(messageCreatedTopic, event.getChatId(), event)
                .whenComplete((result, ex) -> logPublishOutcome("message-created", event.getEventId(), messageCreatedTopic, result, ex));
    }

    public void publishMessageReaction(MessageReactionEventV1 event) {
        log.info("Publishing message-reaction eventId={} chatId={} messageId={} recipients={} topic={}",
                event.getEventId(), event.getChatId(), event.getMessageId(), event.getRecipientUserIds(), messageReactionTopic);
        messageReactionKafkaTemplate.send(messageReactionTopic, event.getChatId(), event)
                .whenComplete((result, ex) -> logPublishOutcome("message-reaction", event.getEventId(), messageReactionTopic, result, ex));
    }

    public void publishRoomMemberInvited(RoomMemberInvitedEventV1 event) {
        log.info("Publishing room-member-invited eventId={} roomId={} inviteeUserId={} topic={}",
                event.getEventId(), event.getRoomId(), event.getInviteeUserId(), roomMemberInvitedTopic);
        roomMemberInvitedKafkaTemplate.send(roomMemberInvitedTopic, event.getRoomId(), event)
                .whenComplete((result, ex) -> logPublishOutcome("room-member-invited", event.getEventId(), roomMemberInvitedTopic, result, ex));
    }

    private void logPublishOutcome(String eventKind, java.util.UUID eventId, String topic,
                                   org.springframework.kafka.support.SendResult<String, ?> result, Throwable ex) {
        if (ex != null) {
            log.error("Failed to publish {} event {}: {}", eventKind, eventId, ex.getMessage(), ex);
        } else if (result != null) {
            log.info("Published {} event {} to topic {} partition {} offset {}",
                    eventKind,
                    eventId,
                    topic,
                    result.getRecordMetadata().partition(),
                    result.getRecordMetadata().offset());
        }
    }
}
