package com.project.webchat.auth.controller;

import com.project.webchat.auth.dto.LoginRequestDTO;
import com.project.webchat.auth.dto.LoginResponseDTO;
import com.project.webchat.auth.dto.RegisterRequestDTO;
import com.project.webchat.auth.feign.UserServiceClient;
import com.project.webchat.auth.service.AuthService;
import com.project.webchat.user.dto.UserDTO;
import com.project.webchat.auth.security.CustomUserDetails;
import com.project.webchat.auth.security.JwtService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
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

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDTO> login(@Valid @RequestBody LoginRequestDTO loginRequestDTO) {
        LoginResponseDTO response = authService.login(loginRequestDTO);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<String> logout() {
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok("Logged out successfully");
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequestDTO registerRequestDTO) {
        try {
            UserDTO registered = authService.register(registerRequestDTO);
            return ResponseEntity.status(HttpStatus.CREATED).body(registered);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
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
