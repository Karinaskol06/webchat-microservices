package com.project.webchat.auth.service;

import com.project.webchat.auth.config.PasswordResetProperties;
import com.project.webchat.auth.feign.UserServiceClient;
import com.project.webchat.shared.dto.ForgotPasswordRequestDTO;
import com.project.webchat.shared.dto.MessageResponseDTO;
import com.project.webchat.shared.dto.ResetPasswordInternalDTO;
import com.project.webchat.shared.dto.ResetPasswordRequestDTO;
import com.project.webchat.shared.dto.UserDTO;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Locale;

@Service
@Slf4j
@RequiredArgsConstructor
public class PasswordResetService {

    private static final int TOKEN_BYTE_LENGTH = 32;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserServiceClient userServiceClient;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordResetNotifier mailSender;
    private final PasswordResetProperties properties;

    public MessageResponseDTO requestPasswordReset(ForgotPasswordRequestDTO request) {
        String email = normalizeEmail(request.getEmail());
        if (tokenRepository.isRateLimited(email)) {
            log.warn("Password reset rate limit exceeded for email hash bucket");
            return genericSuccessResponse();
        }

        try {
            ResponseEntity<UserDTO> response = userServiceClient.getUserByEmail(email);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                return genericSuccessResponse();
            }

            UserDTO user = response.getBody();
            if (user.getUsername() == null || user.getUsername().isBlank()) {
                return genericSuccessResponse();
            }

            String token = generateToken();
            tokenRepository.storeToken(token, user.getUsername().trim());
            String resetLink = buildResetLink(token);
            mailSender.sendPasswordResetEmail(email, resetLink);
        } catch (FeignException e) {
            if (isUserNotFound(e.status())) {
                return genericSuccessResponse();
            }
            log.error("User service error during password reset request: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Password reset is temporarily unavailable");
        } catch (ResponseStatusException e) {
            if (isUserNotFound(e.getStatusCode())) {
                return genericSuccessResponse();
            }
            throw e;
        } catch (Exception e) {
            log.error("Unexpected error during password reset request", e);
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Password reset is temporarily unavailable");
        }

        return genericSuccessResponse();
    }

    public MessageResponseDTO completePasswordReset(ResetPasswordRequestDTO request) {
        String username = tokenRepository.consumeToken(request.getToken())
                .orElseThrow(() -> new IllegalArgumentException(
                        "This reset link is invalid or has expired. Request a new one."));

        ResetPasswordInternalDTO internal = ResetPasswordInternalDTO.builder()
                .username(username)
                .newPassword(request.getNewPassword())
                .build();

        try {
            ResponseEntity<Void> response = userServiceClient.resetPasswordInternal(internal);
            if (!response.getStatusCode().is2xxSuccessful()) {
                throw new IllegalArgumentException("Unable to reset password. Please try again.");
            }
        } catch (FeignException e) {
            if (e.status() == HttpStatus.BAD_REQUEST.value()) {
                throw new IllegalArgumentException(
                        "Password must be at least 6 characters long");
            }
            log.error("User service error during password reset: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Password reset is temporarily unavailable");
        }

        return MessageResponseDTO.builder()
                .message("Your password has been updated. You can sign in with your new password.")
                .build();
    }

    private MessageResponseDTO genericSuccessResponse() {
        return MessageResponseDTO.builder()
                .message(properties.getPublicMessage())
                .build();
    }

    private String buildResetLink(String token) {
        String base = properties.getFrontendBaseUrl().replaceAll("/+$", "");
        String encodedToken = URLEncoder.encode(token, StandardCharsets.UTF_8);
        return base + "/reset-password?token=" + encodedToken;
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private static boolean isUserNotFound(int status) {
        return status == HttpStatus.NOT_FOUND.value();
    }

    private static boolean isUserNotFound(HttpStatusCode status) {
        return status != null && status.value() == HttpStatus.NOT_FOUND.value();
    }

    private static String generateToken() {
        byte[] bytes = new byte[TOKEN_BYTE_LENGTH];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
