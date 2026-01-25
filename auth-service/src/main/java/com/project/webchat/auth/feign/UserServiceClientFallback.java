package com.project.webchat.auth.feign;

import com.project.webchat.shared.dto.CredentialsDTO;
import com.project.webchat.shared.dto.RegisterRequestDTO;
import com.project.webchat.shared.dto.UserCredentialsResponse;
import com.project.webchat.shared.dto.UserDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class UserServiceClientFallback implements UserServiceClient {

    @Override
    public ResponseEntity<UserDTO> registerUser(RegisterRequestDTO requestDTO) {
        log.warn("UserService fallback triggered for registerUser");
        throw new RuntimeException("User service unavailable");
    }

    @Override
    public ResponseEntity<UserDTO> getUserById(Long id) {
        log.warn("UserService fallback triggered for getUserById");
        return ResponseEntity.ok(null);
    }

    @Override
    public ResponseEntity<UserDTO> getUserByUsername(String username) {
        log.warn("UserService fallback triggered for getUserByUsername");
        return ResponseEntity.ok(null);
    }

    @Override
    public ResponseEntity<Boolean> existsByUsername(String username) {
        log.warn("UserService fallback triggered for existsByUsername");
        return ResponseEntity.ok(false);
    }

    @Override
    public ResponseEntity<Boolean> existsByEmail(String email) {
        log.warn("UserService fallback triggered for existsByEmail");
        return ResponseEntity.ok(false);
    }

    @Override
    public ResponseEntity<Boolean> validateCredentials(CredentialsDTO credentialsDTO) {
        log.warn("UserService fallback triggered for validateCredentials");
        return ResponseEntity.ok(false);
    }

    @Override
    public ResponseEntity<UserCredentialsResponse> validateAndGetInfo(CredentialsDTO credentialsDTO) {
        log.warn("UserService fallback triggered for validateAndGetInfo");
        return ResponseEntity.ok(null);
    }
}
