package com.project.webchat.chat.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.Collections;
import java.util.List;

/**
 * Copies REST-style JWT auth into the STOMP session: @stomp/stompjs sends Bearer on CONNECT,
 * but servlet filters never run on the broker channel, so {@link Principal} would stay null otherwise.
 */
@Component
@Slf4j
public class StompJwtChannelInterceptor implements ChannelInterceptor, Ordered {

    @Value("${jwt.secret}")
    private String secretKey;

    @Override
    public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || !StompCommand.CONNECT.equals(accessor.getCommand())) {
            return message;
        }

        String header = firstAuthorizationHeader(accessor);
        if (header.isBlank() || !header.startsWith("Bearer ")) {
            log.warn("STOMP CONNECT missing Bearer Authorization header");
            return message;
        }

        String token = header.substring("Bearer ".length()).trim();
        try {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(secretKey)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();

            Long userId = resolveUserId(claims);
            if (userId == null) {
                log.warn("STOMP CONNECT JWT missing userId claim");
                return message;
            }

            Principal authentication = new UsernamePasswordAuthenticationToken(
                    userId.toString(),
                    null,
                    Collections.emptyList());

            accessor.setUser(authentication);
            log.debug("STOMP CONNECT authenticated user {}", userId);
        } catch (JwtException e) {
            log.warn("Invalid STOMP JWT: {}", e.getMessage());
        }
        return message;
    }

    private static String firstAuthorizationHeader(StompHeaderAccessor accessor) {
        for (String key : List.of("Authorization", "authorization")) {
            List<String> values = accessor.getNativeHeader(key);
            if (values != null && !values.isEmpty()) {
                return values.get(0).trim();
            }
        }
        for (var entry : accessor.toNativeHeaderMap().entrySet()) {
            if (entry.getKey() != null
                    && entry.getKey().equalsIgnoreCase("authorization")
                    && entry.getValue() != null
                    && !entry.getValue().isEmpty()) {
                return entry.getValue().get(0).trim();
            }
        }
        return "";
    }

    private static Long resolveUserId(Claims claims) {
        Object raw = claims.get("userId");
        if (raw == null) {
            return null;
        }
        if (raw instanceof Number n) {
            return n.longValue();
        }
        try {
            return Long.parseLong(raw.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 10;
    }
}
