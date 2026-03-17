package com.project.webchat.chat.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketProperties webSocketProperties;


    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // client sends messages to destinations starting with /app
        config.setApplicationDestinationPrefixes("/app");

        // server broadcasts messages to topics starting with /topic
        config.enableSimpleBroker("/topic");

        // prefix for private messages
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // URL clients connect to initially - with SockJS fallback
        registry.addEndpoint("/ws/chat")
                .setAllowedOrigins("http://localhost:5173") // Your frontend URL
                .withSockJS();

        // If you need raw WebSocket support without SockJS
        registry.addEndpoint("/ws/chat")
                .setAllowedOrigins("http://localhost:5173");
    }
}
