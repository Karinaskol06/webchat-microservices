package com.project.webchat.user.config;

import com.project.webchat.shared.security.GatewayAuthHeaders;
import feign.RequestInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FeignConfig {

    @Bean
    public RequestInterceptor gatewayInternalAuthInterceptor(
            @Value("${gateway.internal-auth-token:local-gateway-token}") String gatewayAuthToken) {
        return template -> template.header(GatewayAuthHeaders.GATEWAY_AUTH, gatewayAuthToken);
    }
}
