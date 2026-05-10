package com.project.webchat.notification.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "app.vapid")
// Holds VAPID keys for sending push notifications in browsers
// Service will use it to get keys and send notification
public class VapidProperties {
    private String publicKey;
    private String privateKey;
    private String subject;
}
