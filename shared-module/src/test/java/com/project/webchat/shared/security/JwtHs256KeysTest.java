package com.project.webchat.shared.security;

import org.junit.jupiter.api.Test;

import javax.crypto.SecretKey;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtHs256KeysTest {

    @Test
    void fromConfiguredSecret_usesBase64WhenAtLeast32Bytes() {
        byte[] raw = new byte[32];
        for (int i = 0; i < raw.length; i++) {
            raw[i] = (byte) i;
        }
        String encoded = Base64.getEncoder().encodeToString(raw);

        SecretKey key = JwtHs256Keys.fromConfiguredSecret(encoded);

        assertThat(key.getAlgorithm()).isEqualTo("HmacSHA256");
        assertThat(key.getEncoded()).isEqualTo(raw);
    }

    @Test
    void fromConfiguredSecret_hashesPlainStringWhenNotBase64() {
        SecretKey key = JwtHs256Keys.fromConfiguredSecret("plain-test-secret");

        assertThat(key.getAlgorithm()).isEqualTo("HmacSHA256");
        assertThat(key.getEncoded()).hasSize(32);
    }

    @Test
    void fromConfiguredSecret_rejectsBlank() {
        assertThatThrownBy(() -> JwtHs256Keys.fromConfiguredSecret("  "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("blank");
    }
}
