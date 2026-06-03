package com.project.webchat.auth.service;

import com.project.webchat.auth.config.PasswordResetProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
@RequiredArgsConstructor
public class RedisPasswordResetTokenRepository implements PasswordResetTokenRepository {

    private static final String TOKEN_KEY_PREFIX = "password-reset:token:";
    private static final String RATE_KEY_PREFIX = "password-reset:rate:";

    private final StringRedisTemplate redisTemplate;
    private final PasswordResetProperties properties;

    @Override
    public void storeToken(String token, String username) {
        String key = TOKEN_KEY_PREFIX + token;
        redisTemplate.opsForValue().set(key, username, properties.getTokenTtl());
    }

    @Override
    public Optional<String> consumeToken(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        String key = TOKEN_KEY_PREFIX + token.trim();
        String username = redisTemplate.opsForValue().get(key);
        if (username == null || username.isBlank()) {
            return Optional.empty();
        }
        redisTemplate.delete(key);
        return Optional.of(username.trim());
    }

    @Override
    public boolean isRateLimited(String normalizedEmail) {
        String key = RATE_KEY_PREFIX + normalizedEmail;
        Long count = redisTemplate.opsForValue().increment(key);
        if (count != null && count == 1L) {
            redisTemplate.expire(key, properties.getRateLimitWindow());
        }
        return count != null && count > properties.getRateLimitMaxRequests();
    }
}
