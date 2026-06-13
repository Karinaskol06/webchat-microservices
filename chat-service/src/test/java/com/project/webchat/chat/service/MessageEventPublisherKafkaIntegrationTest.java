package com.project.webchat.chat.service;

import com.project.webchat.chat.config.KafkaProducerConfig;
import com.project.webchat.shared.events.v1.MessageCreatedEventV1;
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

@SpringBootTest(classes = MessageEventPublisherKafkaIntegrationTest.TestKafkaContext.class)
@ActiveProfiles("test")
@EmbeddedKafka(partitions = 1, topics = {"chat.message.created.v1"})
@TestPropertySource(properties = {
        "spring.kafka.bootstrap-servers=${spring.embedded.kafka.brokers}",
        "app.kafka.topics.message-created=chat.message.created.v1"
})
class MessageEventPublisherKafkaIntegrationTest {

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

    @SuppressWarnings("SpringJavaInjectionPointsAutowiringInspection")
    @Autowired
    private EmbeddedKafkaBroker embeddedKafkaBroker;

    private Consumer<String, MessageCreatedEventV1> consumer;

    @AfterEach
    void tearDown() {
        if (consumer != null) {
            consumer.close();
        }
    }

    @Test
    void publishMessageCreated_deliversEventToKafkaTopic() {
        Map<String, Object> consumerProps = KafkaTestUtils.consumerProps(
                "message-publisher-test-group",
                "false",
                embeddedKafkaBroker
        );
        consumerProps.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");

        JsonDeserializer<MessageCreatedEventV1> valueDeserializer =
                new JsonDeserializer<>(MessageCreatedEventV1.class, false);
        valueDeserializer.addTrustedPackages("com.project.webchat.shared.events.v1");

        consumer = new DefaultKafkaConsumerFactory<>(
                consumerProps,
                new StringDeserializer(),
                valueDeserializer
        ).createConsumer();
        embeddedKafkaBroker.consumeFromAnEmbeddedTopic(consumer, "chat.message.created.v1");

        MessageCreatedEventV1 event = MessageCreatedEventV1.builder()
                .eventId(UUID.randomUUID())
                .occurredAt(Instant.now())
                .schemaVersion(MessageCreatedEventV1.SCHEMA_VERSION_V1)
                .chatId("chat-42")
                .messageId("msg-100")
                .senderId(7L)
                .senderDisplayName("Karina")
                .senderAvatarUrl("/api/users/7/avatar")
                .recipientUserIds(List.of(9L, 11L))
                .previewText("Hello team")
                .messageType("TEXT")
                .build();

        messageEventPublisher.publishMessageCreated(event);

        var record = KafkaTestUtils.getSingleRecord(consumer, "chat.message.created.v1");
        assertThat(record.key()).isEqualTo(event.getChatId());
        assertThat(record.value()).usingRecursiveComparison().isEqualTo(event);
    }
}
