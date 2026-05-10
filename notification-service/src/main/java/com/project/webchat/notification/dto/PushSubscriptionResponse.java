package com.project.webchat.notification.dto;

import com.project.webchat.notification.entity.PushSubscription;
import lombok.Builder;
import lombok.Value;

import java.time.LocalDateTime;

@Value
@Builder
public class PushSubscriptionResponse {
    Long id;
    Long userId;
    String endpoint;
    String userAgent;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;

    public static PushSubscriptionResponse from(PushSubscription subscription) {
        return PushSubscriptionResponse.builder()
                .id(subscription.getId())
                .userId(subscription.getUserId())
                .endpoint(subscription.getEndpoint())
                .userAgent(subscription.getUserAgent())
                .createdAt(subscription.getCreatedAt())
                .updatedAt(subscription.getUpdatedAt())
                .build();
    }
}
