package com.project.webchat.auth.service;

import java.util.Optional;

public interface PasswordResetTokenRepository {

    void storeToken(String token, String username);

    Optional<String> consumeToken(String token);

    boolean isRateLimited(String normalizedEmail);
}
