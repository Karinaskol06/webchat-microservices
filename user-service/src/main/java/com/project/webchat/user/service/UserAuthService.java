package com.project.webchat.user.service;

import com.project.webchat.shared.dto.UserCredentialsResponse;
import com.project.webchat.shared.exceptions.ResourceNotFoundException;
import com.project.webchat.user.dto.ChangePasswordDTO;
import com.project.webchat.user.entity.User;
import com.project.webchat.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class UserAuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public Optional<String> resolveUsernameForLogin(String loginIdentifier) {
        if (loginIdentifier == null || loginIdentifier.isBlank()) {
            return Optional.empty();
        }
        String normalized = loginIdentifier.trim();
        if (normalized.contains("@")) {
            return userRepository.findByEmailIgnoreCase(normalized).map(User::getUsername);
        }
        return userRepository.findByUsername(normalized).map(User::getUsername);
    }

    public boolean validateCredentials(String username, String password) {
        try {
            User user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found " + username));
            if (!user.isActive()) {
                return false;
            }
            return passwordEncoder.matches(password, user.getPasswordHash());
        } catch (ResourceNotFoundException e) {
            return false;
        }
    }

    public UserCredentialsResponse validateAndGetUserInfo(String username, String password) {
        boolean isValid = validateCredentials(username, password);
        if (!isValid) {
            return UserCredentialsResponse.builder()
                    .isValid(false)
                    .build();
        }
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found " + username));

        return UserCredentialsResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .isValid(true)
                .isActive(user.isActive())
                .build();
    }

    public UserCredentialsResponse getUserCredentialsByUsername(String username) {
        log.info("Getting user credentials by username: {}", username);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        if (!user.isActive()) {
            throw new UsernameNotFoundException("User not found: " + username);
        }

        return UserCredentialsResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .password(user.getPasswordHash())
                .email(user.getEmail())
                .isActive(user.isActive())
                .isValid(true)
                .build();
    }

    public void changePassword(String username, ChangePasswordDTO changePasswordDTO) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found " + username));
        if (!passwordEncoder.matches(changePasswordDTO.getOldPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Old password is incorrect");
        }
        String newPassword = changePasswordDTO.getNewPassword();
        if (newPassword == null || newPassword.length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters long");
        }
        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("New password must be different from the current password");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    public void resetPassword(String username, String newPassword) {
        if (newPassword == null || newPassword.length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters long");
        }
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found " + username));
        if (!user.isActive()) {
            throw new IllegalArgumentException("Account is not active");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }
}
