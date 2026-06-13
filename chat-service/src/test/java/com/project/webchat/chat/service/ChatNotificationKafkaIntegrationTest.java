package com.project.webchat.chat.service;

import com.project.webchat.chat.config.KafkaProducerConfig;
import com.project.webchat.shared.events.v1.MessageReactionEventV1;
import com.project.webchat.shared.events.v1.RoomMemberInvitedEventV1;
import org.apache.kafka.clients.consumer.Consumer;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.support.serializer.JsonDeserializer;
import org.springframework.kafka.test.EmbeddedKafkaBroker;
import org.springframework.kafka.test.context.EmbeddedKafka;
import org.springframework.kafka.test.utils.KafkaTestUtils;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = ChatNotificationKafkaIntegrationTest.TestKafkaContext.class)
@ActiveProfiles("test")
@EmbeddedKafka(partitions = 1, topics = {
        "chat.message.reaction.v1",
        "chat.room.member.invited.v1"
})
@TestPropertySource(properties = {
        "spring.kafka.bootstrap-servers=${spring.embedded.kafka.brokers}",
        "app.kafka.topics.message-reaction=chat.message.reaction.v1",
        "app.kafka.topics.room-member-invited=chat.room.member.invited.v1"
})
class ChatNotificationKafkaIntegrationTest {

    @EnableKafka
    @EnableAutoConfiguration(exclude = {
            org.springframework.boot.autoconfigure.mongo.MongoAutoConfiguration.class,
            org.springframework.boot.autoconfigure.data.mongo.MongoDataAutoConfiguration.class,
            org.springframework.boot.autoconfigure.data.mongo.MongoRepositoriesAutoConfiguration.class,
            org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration.class,
            org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration.class
    })
    @Import({KafkaAutoConfiguration.class, KafkaProducerConfig.class, MessageEventPublisher.class})
    static class TestKafkaContext {
    }

    @Autowired
    private MessageEventPublisher messageEventPublisher;

    /** Registered at runtime by {@link EmbeddedKafka}; IDE inspection may not see the bean. */
    @SuppressWarnings("SpringJavaInjectionPointsAutowiringInspection")
    @Autowired
    private EmbeddedKafkaBroker embeddedKafkaBroker;

    private Consumer<String, ?> consumer;

    @AfterEach
    void tearDown() {
        if (consumer != null) {
            consumer.close();
        }
    }

    @Test
    void publishMessageReaction_deliversEventToKafkaTopic() {
        consumer = createConsumer(MessageReactionEventV1.class, "reaction-test-group");
        embeddedKafkaBroker.consumeFromAnEmbeddedTopic(consumer, "chat.message.reaction.v1");

        MessageReactionEventV1 event = MessageReactionEventV1.builder()
                .eventId(UUID.randomUUID())
                .occurredAt(Instant.now())
                .schemaVersion(MessageReactionEventV1.SCHEMA_VERSION_V1)
                .chatId("chat-42")
                .messageId("msg-100")
                .messageSenderId(9L)
                .reactorUserId(7L)
                .reactorDisplayName("Karin")
                .reactorAvatarUrl("/api/users/7/avatar")
                .emoji("👍")
                .recipientUserIds(List.of(9L))
                .messagePreviewText("Hello team")
                .build();

        messageEventPublisher.publishMessageReaction(event);

        @SuppressWarnings("unchecked")
        var record = KafkaTestUtils.<String, MessageReactionEventV1>getSingleRecord(
                (Consumer<String, MessageReactionEventV1>) consumer,
                "chat.message.reaction.v1"
        );
        assertThat(record.key()).isEqualTo(event.getChatId());
        assertThat(record.value()).usingRecursiveComparison().isEqualTo(event);
    }

    @Test
    void publishRoomMemberInvited_deliversEventToKafkaTopic() {
        consumer = createConsumer(RoomMemberInvitedEventV1.class, "invite-test-group");
        embeddedKafkaBroker.consumeFromAnEmbeddedTopic(consumer, "chat.room.member.invited.v1");

        RoomMemberInvitedEventV1 event = RoomMemberInvitedEventV1.builder()
                .eventId(UUID.randomUUID())
                .occurredAt(Instant.now())
                .schemaVersion(RoomMemberInvitedEventV1.SCHEMA_VERSION_V1)
                .inviteId("invite-1")
                .roomId("room-42")
                .roomName("Engineering")
                .roomType("GROUP")
                .inviterUserId(7L)
                .inviterDisplayName("Karin")
                .inviterAvatarUrl("/api/users/7/avatar")
                .inviteeUserId(9L)
                .build();

        messageEventPublisher.publishRoomMemberInvited(event);

        @SuppressWarnings("unchecked")
        var record = KafkaTestUtils.<String, RoomMemberInvitedEventV1>getSingleRecord(
                (Consumer<String, RoomMemberInvitedEventV1>) consumer,
                "chat.room.member.invited.v1"
        );
        assertThat(record.key()).isEqualTo(event.getRoomId());
        assertThat(record.value()).usingRecursiveComparison().isEqualTo(event);
    }

    private <T> Consumer<String, T> createConsumer(Class<T> eventClass, String groupId) {
        Map<String, Object> consumerProps = KafkaTestUtils.consumerProps(
                groupId,
                "false",
                embeddedKafkaBroker
        );
        consumerProps.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");

        JsonDeserializer<T> valueDeserializer = new JsonDeserializer<>(eventClass, false);
        valueDeserializer.addTrustedPackages("com.project.webchat.shared.events.v1");

        return new DefaultKafkaConsumerFactory<>(
                consumerProps,
                new StringDeserializer(),
                valueDeserializer
        ).createConsumer();
    }
}
