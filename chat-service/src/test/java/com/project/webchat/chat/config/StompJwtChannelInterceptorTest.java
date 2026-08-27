package com.project.webchat.chat.config;

import com.project.webchat.shared.security.JwtHs256Keys;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.SecretKey;
import java.util.Date;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class StompJwtChannelInterceptorTest {

    private static final String SECRET = "dGVzdHNlY3JldGtleTEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTA=";

    private final StompJwtChannelInterceptor interceptor = new StompJwtChannelInterceptor();
    private final MessageChannel channel = mock(MessageChannel.class);

    @BeforeEach
    void setSecret() {
        ReflectionTestUtils.setField(interceptor, "secretKey", SECRET);
    }

    @Test
    void connectWithValidJwt_setsUserPrincipal() {
        String token = signedToken(42L);
        Message<?> message = connectMessage("Bearer " + token);

        Message<?> result = interceptor.preSend(message, channel);

        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(result);
        assertThat(accessor.getUser()).isNotNull();
        assertThat(accessor.getUser().getName()).isEqualTo("42");
    }

    @Test
    void connectWithoutBearer_isRejected() {
        Message<?> message = connectMessage(null);

        assertThatThrownBy(() -> interceptor.preSend(message, channel))
                .isInstanceOf(MessageDeliveryException.class)
                .hasMessageContaining("Bearer");
    }

    @Test
    void connectWithInvalidJwt_isRejected() {
        Message<?> message = connectMessage("Bearer not-a-jwt");

        assertThatThrownBy(() -> interceptor.preSend(message, channel))
                .isInstanceOf(MessageDeliveryException.class)
                .hasMessageContaining("Invalid STOMP JWT");
    }

    private static Message<?> connectMessage(String authorization) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setLeaveMutable(true);
        if (authorization != null) {
            accessor.setNativeHeader("Authorization", authorization);
        }
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    private static String signedToken(long userId) {
        SecretKey key = JwtHs256Keys.fromConfiguredSecret(SECRET);
        return Jwts.builder()
                .subject("user-" + userId)
                .claim("userId", userId)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60_000))
                .signWith(key)
                .compact();
    }
}
