package com.project.webchat.notification.security;

import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

@Component
public class JwtUserIdExtractor {

    public Long extractUserId(Jwt jwt) {
        Object userIdClaim = jwt.getClaim("userId");
        if (userIdClaim instanceof Number number) {
            return number.longValue();
        }
        if (userIdClaim instanceof String text && !text.isBlank()) {
            return Long.parseLong(text);
        }
        return Long.parseLong(jwt.getSubject());
    }
}
