package com.project.webchat.user.controller;

import com.project.webchat.user.dto.LoginRequestDTO;
import com.project.webchat.user.dto.LoginResponseDTO;
import com.project.webchat.user.dto.RegisterRequestDTO;
import com.project.webchat.user.dto.UserDTO;
import com.project.webchat.user.security.CustomUserDetails;
import com.project.webchat.user.security.JwtService;
import com.project.webchat.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthenticationController {

    private final UserService userService;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDTO> login(@Valid @RequestBody LoginRequestDTO loginRequestDTO) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        loginRequestDTO.getUsername(),
                        loginRequestDTO.getPassword()
                )
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);
        CustomUserDetails user = (CustomUserDetails) authentication.getPrincipal();
        String token = jwtService.generateToken(user);

        LoginResponseDTO loginResponse = LoginResponseDTO.builder()
                .token(token)
                .type("Bearer")
                .id(user.getUserId())
                .username(user.getUsername())
                .email(user.getEmail())
                .build();

        return ResponseEntity.ok(loginResponse);
    }

    @PostMapping("/logout")
    public ResponseEntity<String> logout() {
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok("Logged out successfully");
    }

    @PostMapping("/register")
    public ResponseEntity<UserDTO> register(@Valid @RequestBody RegisterRequestDTO registerRequestDTO) {
        if (userService.existsByUsername(registerRequestDTO.getUsername())) {
            return ResponseEntity.badRequest().body(null);
        }
        UserDTO registered = userService.registerUser(registerRequestDTO);
        return ResponseEntity.status(HttpStatus.CREATED).body(registered);
    }

    @GetMapping("/validate")
    public ResponseEntity<Boolean> validateToken(@RequestHeader("Authorization") String token) {
        if (token == null || token.isBlank()) {
            return ResponseEntity.ok(false);
        }
        try {
            String jwt = token.replace("Bearer ", "");
            String username = jwtService.extractUsername(jwt);
            return ResponseEntity.ok(username != null);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(false);
        }
    }

}
