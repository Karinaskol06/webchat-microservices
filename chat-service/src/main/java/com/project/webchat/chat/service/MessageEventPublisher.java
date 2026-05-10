package com.project.webchat.chat.service;

import com.project.webchat.shared.events.v1.MessageCreatedEventV1;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class MessageEventPublisher {

    private final KafkaTemplate<String, MessageCreatedEventV1> kafkaTemplate;

    //reads the topic name from application.yml
    @Value("${app.kafka.topics.message-created:chat.message.created.v1}")
    private String messageCreatedTopic;

    public void publishMessageCreated(MessageCreatedEventV1 event) {
        log.info("Publishing message-created eventId={} chatId={} messageId={} recipients={} topic={}",
                event.getEventId(), event.getChatId(), event.getMessageId(), event.getRecipientUserIds(), messageCreatedTopic);
        //asynchronously sends an event to kafka
        kafkaTemplate.send(messageCreatedTopic, event.getChatId(), event)
                .whenComplete((result, ex) -> {
                    //if error occurs - log the error
                    if (ex != null) {
                        log.error("Failed to publish message-created event for message {}: {}",
                                event.getMessageId(), ex.getMessage(), ex);
                    } else if (result != null) {
                        log.info("Published message-created event {} to topic {} partition {} offset {}",
                                event.getEventId(),
                                messageCreatedTopic,
                                result.getRecordMetadata().partition(),
                                result.getRecordMetadata().offset());
                    }
                });
    }
}
