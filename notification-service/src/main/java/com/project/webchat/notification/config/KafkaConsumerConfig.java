package com.project.webchat.notification.config;

import com.project.webchat.notification.service.PermanentNotificationException;
import com.project.webchat.shared.events.v1.MessageCreatedEventV1;
import com.project.webchat.shared.events.v1.MessageReactionEventV1;
import com.project.webchat.shared.events.v1.RoomMemberInvitedEventV1;
import lombok.RequiredArgsConstructor;
import org.apache.kafka.clients.consumer.ConsumerConfig;
import org.apache.kafka.common.serialization.StringDeserializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.ContainerProperties;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.support.serializer.JsonDeserializer;
import org.springframework.util.backoff.FixedBackOff;

import java.util.HashMap;
import java.util.Map;

@Configuration
@EnableKafka
@RequiredArgsConstructor
public class KafkaConsumerConfig {

    @Value("${spring.kafka.bootstrap-servers}")
    private String bootstrapServers;

    @Value("${spring.kafka.consumer.group-id}")
    private String groupId;

    @Value("${app.kafka.topics.message-created-dlq}")
    private String messageCreatedDlqTopic;

    @Value("${app.kafka.topics.message-reaction-dlq}")
    private String messageReactionDlqTopic;

    @Value("${app.kafka.topics.room-member-invited-dlq}")
    private String roomMemberInvitedDlqTopic;

    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Bean
    public ConsumerFactory<String, MessageCreatedEventV1> messageCreatedConsumerFactory() {
        return createConsumerFactory(MessageCreatedEventV1.class);
    }

    @Bean
    public ConsumerFactory<String, MessageReactionEventV1> messageReactionConsumerFactory() {
        return createConsumerFactory(MessageReactionEventV1.class);
    }

    @Bean
    public ConsumerFactory<String, RoomMemberInvitedEventV1> roomMemberInvitedConsumerFactory() {
        return createConsumerFactory(RoomMemberInvitedEventV1.class);
    }

    @Bean
    public DefaultErrorHandler messageCreatedErrorHandler() {
        return createErrorHandler(messageCreatedDlqTopic);
    }

    @Bean
    public DefaultErrorHandler messageReactionErrorHandler() {
        return createErrorHandler(messageReactionDlqTopic);
    }

    @Bean
    public DefaultErrorHandler roomMemberInvitedErrorHandler() {
        return createErrorHandler(roomMemberInvitedDlqTopic);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, MessageCreatedEventV1> messageCreatedKafkaListenerContainerFactory(
            ConsumerFactory<String, MessageCreatedEventV1> consumerFactory,
            DefaultErrorHandler messageCreatedErrorHandler) {
        return createListenerContainerFactory(consumerFactory, messageCreatedErrorHandler);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, MessageReactionEventV1> messageReactionKafkaListenerContainerFactory(
            ConsumerFactory<String, MessageReactionEventV1> consumerFactory,
            DefaultErrorHandler messageReactionErrorHandler) {
        return createListenerContainerFactory(consumerFactory, messageReactionErrorHandler);
    }

    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, RoomMemberInvitedEventV1> roomMemberInvitedKafkaListenerContainerFactory(
            ConsumerFactory<String, RoomMemberInvitedEventV1> consumerFactory,
            DefaultErrorHandler roomMemberInvitedErrorHandler) {
        return createListenerContainerFactory(consumerFactory, roomMemberInvitedErrorHandler);
    }

    private <T> ConsumerFactory<String, T> createConsumerFactory(Class<T> eventClass) {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, groupId);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
        props.put(JsonDeserializer.TRUSTED_PACKAGES, "com.project.webchat.shared.events.v1");
        props.put(JsonDeserializer.VALUE_DEFAULT_TYPE, eventClass.getName());
        props.put(JsonDeserializer.USE_TYPE_INFO_HEADERS, false);
        return new DefaultKafkaConsumerFactory<>(props);
    }

    private DefaultErrorHandler createErrorHandler(String dlqTopic) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(
                kafkaTemplate,
                (record, ex) -> new org.apache.kafka.common.TopicPartition(dlqTopic, record.partition())
        );
        DefaultErrorHandler errorHandler = new DefaultErrorHandler(recoverer, new FixedBackOff(2000L, 3L));
        errorHandler.addNotRetryableExceptions(PermanentNotificationException.class, IllegalArgumentException.class);
        return errorHandler;
    }

    private static <T> ConcurrentKafkaListenerContainerFactory<String, T> createListenerContainerFactory(
            ConsumerFactory<String, T> consumerFactory,
            DefaultErrorHandler errorHandler) {
        ConcurrentKafkaListenerContainerFactory<String, T> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        factory.setCommonErrorHandler(errorHandler);
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.MANUAL);
        return factory;
    }
}
