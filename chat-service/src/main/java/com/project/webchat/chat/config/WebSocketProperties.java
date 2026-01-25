package com.project.webchat.chat.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "websocket")
public class WebSocketProperties {
    private String endpoint = "/ws/chat";
    private String[] allowedOrigins = {"*"};
    private int messageSizeLimit = 32768; //32KB
    private int bufferSize = 51200; //50KB


}
