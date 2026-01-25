package com.project.webchat.auth.service;

import com.project.webchat.auth.entity.AuthUser;
import com.project.webchat.auth.repository.AuthUserRepository;
import com.project.webchat.shared.dto.LoginRequestDTO;
import com.project.webchat.shared.dto.LoginResponseDTO;
import com.project.webchat.shared.dto.RegisterRequestDTO;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.auth.feign.UserServiceClient;
import com.project.webchat.auth.security.CustomUserDetails;
import com.project.webchat.auth.security.JwtService;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    @Qualifier("com.project.webchat.auth.feign.UserServiceClient")
    private final UserServiceClient userServiceClient;
    private final AuthUserRepository authUserRepository;
    private final PasswordEncoder passwordEncoder;

    public LoginResponseDTO login(LoginRequestDTO loginRequestDTO) {

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        loginRequestDTO.getUsername(),
                        loginRequestDTO.getPassword()
                )
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);
        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        //generate token based on user details
        String token = jwtService.generateToken(userDetails);

        return LoginResponseDTO.builder()
                .token(token)
                .type("Bearer")
                .id(userDetails.getUserServiceId())
                .username(userDetails.getUsername())
                .email(userDetails.getEmail())
                .build();
    }

    public UserDTO register(RegisterRequestDTO registerRequestDTO) {
        try {
            if (authUserRepository.existsByUsername(registerRequestDTO.getUsername())) {
                throw new IllegalArgumentException("Username already exists");
            }
            if (authUserRepository.existsByEmail(registerRequestDTO.getEmail())) {
                throw new IllegalArgumentException("Email already exists");
            }

            ResponseEntity<UserDTO> userResponse = userServiceClient.registerUser(registerRequestDTO);
            UserDTO createdUser = userResponse.getBody();
            if (createdUser == null) {
                throw new RuntimeException("Failed to create user in user-service");
            }

            AuthUser authUser = AuthUser.builder()
                    .username(createdUser.getUsername())
                    .email(createdUser.getEmail())
                    .passwordHash(passwordEncoder.encode(registerRequestDTO.getPassword()))
                    .firstName(createdUser.getFirstName())
                    .lastName(createdUser.getLastName())
                    .userServiceId(createdUser.getId())
                    .active(true)
                    .build();
            authUserRepository.save(authUser);

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
