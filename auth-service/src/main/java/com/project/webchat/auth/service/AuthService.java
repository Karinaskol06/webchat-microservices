package com.project.webchat.auth.service;

import com.project.webchat.shared.dto.*;
import com.project.webchat.auth.feign.UserServiceClient;
import com.project.webchat.auth.security.CustomUserDetails;
import com.project.webchat.auth.security.JwtService;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final JwtService jwtService;
    @Qualifier("com.project.webchat.auth.feign.UserServiceClient")
    private final UserServiceClient userServiceClient;

    public LoginResponseDTO login(LoginRequestDTO loginRequestDTO) {

        CredentialsDTO credentials = CredentialsDTO.builder()
                .username(loginRequestDTO.getUsername())
                .password(loginRequestDTO.getPassword())
                .build();

        UserCredentialsResponse userInfo = userServiceClient.validateAndGetInfo(credentials).getBody();

        if (userInfo == null || !userInfo.isValid()) {
            throw new RuntimeException("Invalid credentials");
        }

        UserDTO userDTO = userServiceClient.getUserByUsername(loginRequestDTO.getUsername()).getBody();
        if (userDTO == null) {
            throw new RuntimeException("User not found");
        }

        CustomUserDetails customUserDetails = new CustomUserDetails(userDTO, userInfo.getPassword());
        String token = jwtService.generateToken(customUserDetails);

        return LoginResponseDTO.builder()
                .token(token)
                .type("Bearer")
                .id(userDTO.getId())
                .username(userDTO.getUsername())
                .email(userDTO.getEmail())
                .build();
    }

    public UserDTO register(RegisterRequestDTO registerRequestDTO) {
        try {
            Boolean usernameExists = userServiceClient.existsByUsername(registerRequestDTO.getUsername()).getBody();
            Boolean emailExists = userServiceClient.existsByEmail(registerRequestDTO.getEmail()).getBody();

            if (Boolean.TRUE.equals(usernameExists)) {
                throw new IllegalArgumentException("Username already exists");
            }
            if (Boolean.TRUE.equals(emailExists)) {
                throw new IllegalArgumentException("Email already exists");
            }

            UserDTO createdUser = userServiceClient.registerUser(registerRequestDTO).getBody();
            if (createdUser == null) {
                throw new RuntimeException("Failed to create user in user-service");
            }

            return createdUser;

        } catch (Exception e) {
            log.error("Registration failed: {}", e.getMessage());
            if (e instanceof IllegalArgumentException) {
                throw e;
            }
            throw new RuntimeException("Registration failed: " + e.getMessage(), e);
        }
    }

    public boolean validateToken(String token) {
        return jwtService.validateToken(token);
    }

    public UserDTO getUserFromToken(String token) {
        String username = jwtService.extractUsername(token);
        try {
            ResponseEntity<UserDTO> response = userServiceClient.getUserByUsername(username);
            if (response.getStatusCode().is2xxSuccessful()) {
                return response.getBody();
            }
            return null;
        } catch (FeignException e) {
            log.error("Error getting user: {}", e.getMessage());
            return null;
        }
    }
}
