package com.project.webchat.auth.service;

import com.project.webchat.auth.config.PasswordResetProperties;
import com.project.webchat.auth.feign.UserServiceClient;
import com.project.webchat.shared.dto.ForgotPasswordRequestDTO;
import com.project.webchat.shared.dto.MessageResponseDTO;
import com.project.webchat.shared.dto.ResetPasswordInternalDTO;
import com.project.webchat.shared.dto.ResetPasswordRequestDTO;
import com.project.webchat.shared.dto.UserDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PasswordResetServiceTest {

    private final InMemoryPasswordResetTokenRepository tokenRepository =
            new InMemoryPasswordResetTokenRepository();
    private final RecordingMailSender mailSender = new RecordingMailSender();
    private final FakeUserServiceClient userServiceClient = new FakeUserServiceClient();
    private PasswordResetProperties properties;
    private PasswordResetService passwordResetService;

    @BeforeEach
    void setUp() {
        tokenRepository.clear();
        mailSender.clear();
        userServiceClient.clear();
        properties = new PasswordResetProperties();
        properties.setFrontendBaseUrl("http://localhost:5173");
        passwordResetService = new PasswordResetService(
                userServiceClient, tokenRepository, mailSender, properties);
    }

    @Test
    void requestPasswordReset_unknownEmail_returnsGenericMessageWithoutSendingMail() {
        userServiceClient.emailLookupResult = ResponseEntity.notFound().build();

        MessageResponseDTO response = passwordResetService.requestPasswordReset(
                ForgotPasswordRequestDTO.builder().email("unknown@example.com").build());

        assertThat(response.getMessage()).isEqualTo(properties.getPublicMessage());
        assertThat(mailSender.sent).isEmpty();
        assertThat(tokenRepository.tokens).isEmpty();
    }

    @Test
    void requestPasswordReset_knownEmail_storesTokenAndSendsMail() {
        userServiceClient.emailLookupResult = ResponseEntity.ok(UserDTO.builder()
                .username("karina")
                .email("user@example.com")
                .build());

        passwordResetService.requestPasswordReset(
                ForgotPasswordRequestDTO.builder().email("user@example.com").build());

        assertThat(tokenRepository.tokens).hasSize(1);
        assertThat(tokenRepository.tokens.values()).containsExactly("karina");
        assertThat(mailSender.sent).hasSize(1);
        assertThat(mailSender.sent.get(0).email()).isEqualTo("user@example.com");
        assertThat(mailSender.sent.get(0).link()).contains("/reset-password?token=");
    }

    @Test
    void completePasswordReset_invalidToken_throws() {
        assertThatThrownBy(() -> passwordResetService.completePasswordReset(
                ResetPasswordRequestDTO.builder()
                        .token("bad-token")
                        .newPassword("secret12")
                        .confirmPassword("secret12")
                        .build()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("invalid or has expired");
    }

    @Test
    void completePasswordReset_validToken_updatesPassword() {
        tokenRepository.tokens.put("good-token", "karina");
        userServiceClient.resetResult = ResponseEntity.noContent().build();

        MessageResponseDTO response = passwordResetService.completePasswordReset(
                ResetPasswordRequestDTO.builder()
                        .token("good-token")
                        .newPassword("secret12")
                        .confirmPassword("secret12")
                        .build());

        assertThat(response.getMessage()).contains("password has been updated");
        assertThat(tokenRepository.tokens).isEmpty();
        assertThat(userServiceClient.lastResetRequest).isEqualTo(
                ResetPasswordInternalDTO.builder()
                        .username("karina")
                        .newPassword("secret12")
                        .build());
    }

    private static final class InMemoryPasswordResetTokenRepository implements PasswordResetTokenRepository {
        private final Map<String, String> tokens = new ConcurrentHashMap<>();
        private final Map<String, Integer> rateCounts = new ConcurrentHashMap<>();

        void clear() {
            tokens.clear();
            rateCounts.clear();
        }

        @Override
        public void storeToken(String token, String username) {
            tokens.put(token, username);
        }

        @Override
        public Optional<String> consumeToken(String token) {
            if (token == null || token.isBlank()) {
                return Optional.empty();
            }
            String username = tokens.remove(token.trim());
            return username == null || username.isBlank()
                    ? Optional.empty()
                    : Optional.of(username);
        }

        @Override
        public boolean isRateLimited(String normalizedEmail) {
            int count = rateCounts.merge(normalizedEmail, 1, Integer::sum);
            return count > 3;
        }
    }

    private static final class RecordingMailSender implements PasswordResetNotifier {
        private final List<SentMail> sent = new ArrayList<>();

        void clear() {
            sent.clear();
        }

        @Override
        public void sendPasswordResetEmail(String recipientEmail, String resetLink) {
            sent.add(new SentMail(recipientEmail, resetLink));
        }

        private record SentMail(String email, String link) {}
    }

    private static final class FakeUserServiceClient implements UserServiceClient {
        private ResponseEntity<UserDTO> emailLookupResult = ResponseEntity.notFound().build();
        private ResponseEntity<Void> resetResult = ResponseEntity.noContent().build();
        private ResetPasswordInternalDTO lastResetRequest;

        void clear() {
            emailLookupResult = ResponseEntity.notFound().build();
            resetResult = ResponseEntity.noContent().build();
            lastResetRequest = null;
        }

        @Override
        public ResponseEntity<UserDTO> getUserByEmail(String email) {
            return emailLookupResult;
        }

        @Override
        public ResponseEntity<Void> resetPasswordInternal(ResetPasswordInternalDTO request) {
            lastResetRequest = request;
            return resetResult;
        }

        @Override
        public ResponseEntity<UserDTO> registerUser(com.project.webchat.shared.dto.RegisterRequestDTO requestDTO) {
            throw new UnsupportedOperationException();
        }

        @Override
        public ResponseEntity<UserDTO> getUserById(Long id) {
            throw new UnsupportedOperationException();
        }

        @Override
        public ResponseEntity<UserDTO> getUserByUsername(String username) {
            throw new UnsupportedOperationException();
        }

        @Override
        public ResponseEntity<Boolean> existsByUsername(String username) {
            throw new UnsupportedOperationException();
        }

        @Override
        public ResponseEntity<Boolean> existsByEmail(String email) {
            throw new UnsupportedOperationException();
        }

        @Override
        public ResponseEntity<String> resolveLoginIdentifier(String loginIdentifier) {
            throw new UnsupportedOperationException();
        }

        @Override
        public ResponseEntity<Boolean> validateCredentials(
                com.project.webchat.shared.dto.CredentialsDTO credentialsDTO) {
            throw new UnsupportedOperationException();
        }

        @Override
        public ResponseEntity<com.project.webchat.shared.dto.UserCredentialsResponse> validateAndGetInfo(
                com.project.webchat.shared.dto.CredentialsDTO credentialsDTO) {
            throw new UnsupportedOperationException();
        }

        @Override
        public ResponseEntity<com.project.webchat.shared.dto.UserCredentialsResponse> getUserWithPasswordByUsername(
                String username) {
            throw new UnsupportedOperationException();
        }
    }
}
