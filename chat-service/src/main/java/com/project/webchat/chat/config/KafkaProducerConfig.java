package com.project.webchat.chat.config;

import com.project.webchat.shared.events.v1.MessageCreatedEventV1;
import com.project.webchat.shared.events.v1.MessageReactionEventV1;
import com.project.webchat.shared.events.v1.RoomMemberInvitedEventV1;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.common.serialization.StringSerializer;
import org.springframework.boot.autoconfigure.kafka.KafkaProperties;
import org.springframework.boot.ssl.SslBundles;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.DefaultKafkaProducerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.kafka.support.serializer.JsonSerializer;

import java.util.HashMap;
import java.util.Map;

@Configuration
public class KafkaProducerConfig {

    @Bean
    public ProducerFactory<String, MessageCreatedEventV1> messageCreatedProducerFactory(
            KafkaProperties kafkaProperties,
            SslBundles sslBundles
    ) {
        return createProducerFactory(kafkaProperties, sslBundles);
    }

    @Bean
    public KafkaTemplate<String, MessageCreatedEventV1> messageCreatedKafkaTemplate(
            ProducerFactory<String, MessageCreatedEventV1> messageCreatedProducerFactory
    ) {
        return new KafkaTemplate<>(messageCreatedProducerFactory);
    }

    @Bean
    public ProducerFactory<String, MessageReactionEventV1> messageReactionProducerFactory(
            KafkaProperties kafkaProperties,
            SslBundles sslBundles
    ) {
        return createProducerFactory(kafkaProperties, sslBundles);
    }

    @Bean
    public KafkaTemplate<String, MessageReactionEventV1> messageReactionKafkaTemplate(
            ProducerFactory<String, MessageReactionEventV1> messageReactionProducerFactory
    ) {
        return new KafkaTemplate<>(messageReactionProducerFactory);
    }

    @Bean
    public ProducerFactory<String, RoomMemberInvitedEventV1> roomMemberInvitedProducerFactory(
            KafkaProperties kafkaProperties,
            SslBundles sslBundles
    ) {
        return createProducerFactory(kafkaProperties, sslBundles);
    }

    @Bean
    public KafkaTemplate<String, RoomMemberInvitedEventV1> roomMemberInvitedKafkaTemplate(
            ProducerFactory<String, RoomMemberInvitedEventV1> roomMemberInvitedProducerFactory
    ) {
        return new KafkaTemplate<>(roomMemberInvitedProducerFactory);
    }

    private static <T> ProducerFactory<String, T> createProducerFactory(
            KafkaProperties kafkaProperties,
            SslBundles sslBundles
    ) {
        Map<String, Object> producerProperties = new HashMap<>(kafkaProperties
                .buildProducerProperties(sslBundles));
        producerProperties.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        producerProperties.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);
        producerProperties.put(ProducerConfig.ACKS_CONFIG, "all");
        producerProperties.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        producerProperties.put(ProducerConfig.RETRIES_CONFIG, Integer.MAX_VALUE);
        return new DefaultKafkaProducerFactory<>(producerProperties);
    }
}
