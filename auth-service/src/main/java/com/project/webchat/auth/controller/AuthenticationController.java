package com.project.webchat.auth.controller;

import com.project.webchat.auth.feign.UserServiceClient;
import com.project.webchat.shared.dto.LoginRequestDTO;
import com.project.webchat.shared.dto.LoginResponseDTO;
import com.project.webchat.shared.dto.RegisterRequestDTO;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.auth.service.AuthService;
import com.project.webchat.auth.security.JwtService;
import feign.FeignException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthenticationController {

    private final JwtService jwtService;
    private final AuthService authService;
    private final UserServiceClient userServiceClient;

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDTO> login(
            @Valid @RequestBody LoginRequestDTO loginRequestDTO) {
        try {
            LoginResponseDTO response = authService.login(loginRequestDTO);
            return ResponseEntity.ok(response);
        } catch (BadCredentialsException e) {
            throw e;
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<String> logout() {
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok("Logged out successfully");
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequestDTO registerRequest) {
        try {
            ResponseEntity<Boolean> usernameExists = userServiceClient
                    .existsByUsername(registerRequest.getUsername());
            ResponseEntity<Boolean> emailExists = userServiceClient
                    .existsByEmail(registerRequest.getEmail());

            if (Boolean.TRUE.equals(usernameExists.getBody())) {
                return ResponseEntity.badRequest().body("Username already exists");
            }
            if (Boolean.TRUE.equals(emailExists.getBody())) {
                return ResponseEntity.badRequest().body("Email already exists");
            }

            UserDTO registered = authService.register(registerRequest);
            return ResponseEntity.status(HttpStatus.CREATED).body(registered);

        } catch (FeignException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body("USer service unavailable");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/me")
    public ResponseEntity<UserDTO> getCurrentUser() {
        // get authentication from SecurityContext (already validated by JwtAuthFilter)
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated() ||
                "anonymousUser".equals(authentication.getPrincipal())) {
            log.warn("User not authenticated");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            // get username from authentication
            String username = authentication.getName();

            // get user data from user-service
            ResponseEntity<UserDTO> response = userServiceClient.getUserByUsername(username);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return ResponseEntity.ok(response.getBody());
            } else {
                log.warn("User not found in user-service: {}", username);
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            }

        } catch (FeignException e) {
            log.error("Error calling user-service for user: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        } catch (Exception e) {
            log.error("Error getting current user: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/validate")
    public ResponseEntity<?> validateToken(@RequestHeader(value = "Authorization", required = false)
                                               String token) {
        if (token == null || token.isBlank() || !token.startsWith("Bearer ")) {
            return ResponseEntity.ok(Map.of("valid", false, "message", "No token provided"));
        }

        try {
            String jwt = token.replace("Bearer ", "");
            Boolean isValid = jwtService.validateToken(jwt);
            if (isValid) {
                String username = jwtService.extractUsername(jwt);
                Map<String, Object> response = new HashMap<>();
                response.put("username", username);
                response.put("valid", true);
                response.put("message", "Token is valid");
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.ok(Map.of("valid", false,
                        "message", "Token expired or invalid"));
            }

        } catch (Exception e) {
            log.error("Token validation error: {}" + e.getMessage());
            return ResponseEntity.ok(Map.of("valid", false,
                    "message", "Token validation error"));
        }
    }

}
