package com.project.webchat.notification.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PushSubscriptionRequest {
    @NotBlank
    private String endpoint;

    @Valid
    @NotNull
    private SubscriptionKeys keys;

    /**
     * Optional: an endpoint that the client just unsubscribed from in the
     * browser (e.g. when the VAPID key changed and a fresh subscribe was
     * required). The backend will drop the matching row so we don't keep
     * trying to push to dead endpoints.
     */
    private String previousEndpoint;

    @Data
    public static class SubscriptionKeys {
        @NotBlank
        private String p256dh; //each push massage must be encrypted using p256dh key

        @NotBlank
        private String auth;
    }
}
