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
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class AuthService {

    private final JwtService jwtService;
    private final UserServiceClient userServiceClient;
    private final AuthenticationManager authenticationManager;

    public LoginResponseDTO login(LoginRequestDTO loginRequestDTO) {

        try {
            // authenticate using Spring Security
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(
                            loginRequestDTO.getUsername(),
                            loginRequestDTO.getPassword()
                    )
            );

            // get UserDetails for authentication
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();

            // generate JWT token
            String token = jwtService.generateToken(userDetails);

            // cast to CustomUserDetails to get additional fields
            CustomUserDetails customUserDetails = (CustomUserDetails) userDetails;

            return LoginResponseDTO.builder()
                    .token(token)
                    .type("Bearer")
                    .id(customUserDetails.getId())
                    .username(customUserDetails.getUsername())
                    .email(customUserDetails.getEmail())
                    .build();

        } catch (BadCredentialsException e) {
            log.warn("Failed login attempt for user: {}", loginRequestDTO.getUsername());
            throw new BadCredentialsException("Invalid username or password");
        }
    }

    public UserDTO register(RegisterRequestDTO registerRequestDTO) {
        try {
            //check if username exists
            Boolean usernameExists = userServiceClient.existsByUsername(registerRequestDTO.getUsername()).getBody();
            if (Boolean.TRUE.equals(usernameExists)) {
                throw new IllegalArgumentException("Username already exists");
            }

            //check if email exists
            Boolean emailExists = userServiceClient.existsByEmail(registerRequestDTO.getEmail()).getBody();
            if (Boolean.TRUE.equals(emailExists)) {
                throw new IllegalArgumentException("Email already exists");
            }

            //register user
            ResponseEntity<UserDTO> response = userServiceClient.registerUser(registerRequestDTO);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new RuntimeException("Failed to create user");
            }

            log.info("User registered successfully: {}", registerRequestDTO.getUsername());
            return response.getBody();

        } catch (FeignException e) {
            log.error("Feign error during registration: {}", e.getMessage());
            throw new RuntimeException("Registration service unavailable", e);
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
