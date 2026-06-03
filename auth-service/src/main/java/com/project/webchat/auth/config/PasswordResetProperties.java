package com.project.webchat.auth.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "password-reset")
public class PasswordResetProperties {

    private Duration tokenTtl = Duration.ofHours(1);
    private String frontendBaseUrl = "http://localhost:5173";
    private int rateLimitMaxRequests = 3;
    private Duration rateLimitWindow = Duration.ofMinutes(15);
    private String publicMessage =
            "If an account exists for that email, you will receive password reset instructions shortly.";
}
