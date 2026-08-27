package com.project.webchat.shared.security;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;

/**
 * Authentication used when a caller presents a valid {@link GatewayAuthHeaders#GATEWAY_AUTH}
 * token without a user identity (service-to-service / internal Feign calls).
 */
public final class InternalServiceAuthentication {

    public static final String PRINCIPAL = "internal-service";
    public static final String ROLE = "ROLE_INTERNAL";

    private InternalServiceAuthentication() {
    }

    public static Authentication create() {
        return new UsernamePasswordAuthenticationToken(
                PRINCIPAL,
                null,
                List.of(new SimpleGrantedAuthority(ROLE)));
    }
}
