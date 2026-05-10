package com.project.webchat.notification.config;

import com.project.webchat.notification.service.PermanentNotificationException;
import com.project.webchat.shared.events.v1.MessageCreatedEventV1;
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

    private final KafkaTemplate<String, Object> kafkaTemplate;

    // Factory that knows how to create consumers for MessageCreatedEventV1
    @Bean
    public ConsumerFactory<String, MessageCreatedEventV1> messageCreatedConsumerFactory() {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrapServers);
        props.put(ConsumerConfig.GROUP_ID_CONFIG, groupId);
        props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
        props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, JsonDeserializer.class);
        props.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest");
        props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);
        props.put(JsonDeserializer.TRUSTED_PACKAGES, "com.project.webchat.shared.events.v1");
        props.put(JsonDeserializer.VALUE_DEFAULT_TYPE, MessageCreatedEventV1.class.getName());
        props.put(JsonDeserializer.USE_TYPE_INFO_HEADERS, false);
        return new DefaultKafkaConsumerFactory<>(props);
    }

    // Error handles that uses DLQ recoverer
    @Bean
    public DefaultErrorHandler messageCreatedErrorHandler() {
        //if all retries fail, sends the record to the DLQ topic
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(
                kafkaTemplate,
                (record, ex) -> new org.apache.kafka.common.TopicPartition(
                        messageCreatedDlqTopic, record.partition())
        );

        DefaultErrorHandler errorHandler = new DefaultErrorHandler(recoverer,
                new FixedBackOff(2000L, 3L));
        //go straightly to DLQ
        errorHandler.addNotRetryableExceptions(PermanentNotificationException.class, IllegalArgumentException.class);
        return errorHandler;
    }

    // Container factory used to run the listener
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, MessageCreatedEventV1> messageCreatedKafkaListenerContainerFactory(
            ConsumerFactory<String, MessageCreatedEventV1> consumerFactory,
            DefaultErrorHandler messageCreatedErrorHandler) {
        ConcurrentKafkaListenerContainerFactory<String, MessageCreatedEventV1> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        factory.setCommonErrorHandler(messageCreatedErrorHandler);
        factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.MANUAL);
        return factory;
    }
}
