package com.project.webchat.shared.security;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

/**
 * Derives a 256-bit HMAC key from {@code jwt.secret} the same way in every service:
 * if the value is Base64 and decodes to at least 32 bytes, use it; otherwise SHA-256(UTF-8).
 */
public final class JwtHs256Keys {

    private JwtHs256Keys() {
    }

    public static SecretKey fromConfiguredSecret(String configured) {
        if (configured == null || configured.isBlank()) {
            throw new IllegalArgumentException("JWT secret must not be blank");
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(configured);
            if (decoded.length >= 32) {
                return new SecretKeySpec(decoded, "HmacSHA256");
            }
        } catch (IllegalArgumentException ignored) {
            // not valid Base64 — treat as plain string
        }
        byte[] hash = sha256(configured.getBytes(StandardCharsets.UTF_8));
        return new SecretKeySpec(hash, "HmacSHA256");
    }

    private static byte[] sha256(byte[] input) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(input);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
