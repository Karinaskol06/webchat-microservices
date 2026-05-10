package com.project.webchat.chat.config;

import com.project.webchat.shared.events.v1.MessageCreatedEventV1;
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
        Map<String, Object> producerProperties = new HashMap<>(kafkaProperties
                .buildProducerProperties(sslBundles));
        //convert java objects to bytes
        producerProperties.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
        producerProperties.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, JsonSerializer.class);

        //the leader broker waits for all in-sync replicas to acknowledge the write
        producerProperties.put(ProducerConfig.ACKS_CONFIG, "all");
        //prevents duplicates if retrying
        producerProperties.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);
        producerProperties.put(ProducerConfig.RETRIES_CONFIG, Integer.MAX_VALUE);

        //will produce events with ID key and MessageCreatedEventV1 value
        //without it KafkaTemplate can't be created
        return new DefaultKafkaProducerFactory<>(producerProperties);
    }

    @Bean
    public KafkaTemplate<String, MessageCreatedEventV1> messageCreatedKafkaTemplate(
            ProducerFactory<String, MessageCreatedEventV1> messageCreatedProducerFactory
    ) {
        //wraps producer factory (high-level abstraction) and provides methods
        return new KafkaTemplate<>(messageCreatedProducerFactory);
    }
}
