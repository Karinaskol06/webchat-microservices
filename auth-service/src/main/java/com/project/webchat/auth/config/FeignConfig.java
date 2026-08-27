package com.project.webchat.auth.config;

import com.project.webchat.auth.feign.FeignErrorDecoder;
import com.project.webchat.shared.security.GatewayAuthHeaders;
import feign.RequestInterceptor;
import feign.codec.ErrorDecoder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class FeignConfig {

    @Bean
    public ErrorDecoder errorDecoder() {
        return new FeignErrorDecoder();
    }

    @Bean
    public feign.Logger.Level feignLoggerLevel() {
        return feign.Logger.Level.FULL;
    }

    @Bean
    public RequestInterceptor requestInterceptor(
            @Value("${gateway.internal-auth-token:local-gateway-token}") String gatewayAuthToken) {
        return requestTemplate -> {
            requestTemplate.header("X-Correlation-ID",
                    java.util.UUID.randomUUID().toString());
            requestTemplate.header(GatewayAuthHeaders.GATEWAY_AUTH, gatewayAuthToken);
        };
    }
}
