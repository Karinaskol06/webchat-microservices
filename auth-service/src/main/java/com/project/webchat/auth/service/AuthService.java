package com.project.webchat.auth.service;

import com.project.webchat.shared.dto.*;
import com.project.webchat.auth.feign.UserServiceClient;
import com.project.webchat.auth.security.CustomUserDetails;
import com.project.webchat.auth.security.JwtService;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
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

    private static final int PASSWORD_MIN_LENGTH = 6;
    private static final String PASSWORD_LENGTH_MESSAGE =
            "Password must be at least 6 characters long";
    private static final String USER_DOES_NOT_EXIST_MESSAGE = "User does not exist";
    private static final String INCORRECT_PASSWORD_MESSAGE = "Incorrect password";

    public LoginResponseDTO login(LoginRequestDTO loginRequestDTO) {
        String username = loginRequestDTO.getUsername();
        String password = loginRequestDTO.getPassword();

        if (password == null || password.length() < PASSWORD_MIN_LENGTH) {
            throw new IllegalArgumentException(PASSWORD_LENGTH_MESSAGE);
        }

        try {
            Boolean exists = userServiceClient.existsByUsername(username).getBody();
            if (!Boolean.TRUE.equals(exists)) {
                throw new IllegalArgumentException(USER_DOES_NOT_EXIST_MESSAGE);
            }

            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(username, password));

            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            String token = jwtService.generateToken(userDetails);
            CustomUserDetails customUserDetails = (CustomUserDetails) userDetails;

            return LoginResponseDTO.builder()
                    .token(token)
                    .type("Bearer")
                    .id(customUserDetails.getId())
                    .username(customUserDetails.getUsername())
                    .email(customUserDetails.getEmail())
                    .build();

        } catch (BadCredentialsException e) {
            log.warn("Failed login attempt for user: {}", username);
            throw new BadCredentialsException(INCORRECT_PASSWORD_MESSAGE, e);
        } catch (ResponseStatusException e) {
            log.error("User service error during login: {}", e.getStatusCode(), e);
            throw mapUserServiceFailureToLoginResponse(e);
        } catch (FeignException e) {
            log.error("Feign error during login: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Authentication service temporarily unavailable", e);
        }
    }

    private static ResponseStatusException mapUserServiceFailureToLoginResponse(ResponseStatusException e) {
        HttpStatusCode status = e.getStatusCode();
        if (status.is5xxServerError() || status.equals(HttpStatus.BAD_GATEWAY)
                || status.equals(HttpStatus.SERVICE_UNAVAILABLE) || status.equals(HttpStatus.GATEWAY_TIMEOUT)) {
            return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Authentication service temporarily unavailable", e);
        }
        return e;
    }

    public UserDTO register(RegisterRequestDTO registerRequestDTO) {
        try {
            //check if username exists
            Boolean usernameExists = userServiceClient.existsByUsername(registerRequestDTO.getUsername()).getBody();
            if (Boolean.TRUE.equals(usernameExists)) {
                throw new IllegalArgumentException("Username already exists");
            }

            //check if email exists (trimmed to match persistence and duplicate checks)
            String email = registerRequestDTO.getEmail() == null ? null : registerRequestDTO.getEmail().trim();
            Boolean emailExists = userServiceClient.existsByEmail(email).getBody();
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

        } catch (ResponseStatusException e) {
            log.error("User service error during registration: {}", e.getStatusCode(), e);
            HttpStatusCode status = e.getStatusCode();
            if (status.is5xxServerError() || status.equals(HttpStatus.BAD_GATEWAY)
                    || status.equals(HttpStatus.SERVICE_UNAVAILABLE) || status.equals(HttpStatus.GATEWAY_TIMEOUT)) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Registration service temporarily unavailable", e);
            }
            throw e;
        } catch (FeignException e) {
            log.error("Feign error during registration: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Registration service temporarily unavailable", e);
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
        } catch (ResponseStatusException e) {
            log.error("Error getting user: {}", e.getStatusCode(), e);
            return null;
        } catch (FeignException e) {
            log.error("Error getting user: {}", e.getMessage());
            return null;
        }
    }
}
