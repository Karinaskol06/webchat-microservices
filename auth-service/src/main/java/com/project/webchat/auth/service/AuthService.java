package com.project.webchat.auth.service;

import com.project.webchat.auth.dto.LoginRequestDTO;
import com.project.webchat.auth.dto.LoginResponseDTO;
import com.project.webchat.auth.dto.RegisterRequestDTO;
import com.project.webchat.auth.feign.UserServiceClient;
import com.project.webchat.auth.security.CustomUserDetails;
import com.project.webchat.auth.security.JwtService;
import com.project.webchat.user.dto.UserDTO;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserServiceClient userServiceClient;

    public LoginResponseDTO login(LoginRequestDTO loginRequestDTO) {

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        loginRequestDTO.getUsername(),
                        loginRequestDTO.getPassword()
                )
        );

        SecurityContextHolder.getContext().setAuthentication(authentication);
        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();

        //getting user information via feign
        ResponseEntity<UserDTO> userResponse = userServiceClient.getUserByUsername(
                loginRequestDTO.getUsername()
        );
        UserDTO user = userResponse.getBody();

        //generate token based on user details
        String token = jwtService.generateToken(userDetails);

        return LoginResponseDTO.builder()
                .token(token)
                .type("Bearer")
                .id(user != null ? user.getId() : null)
                .username(user != null ? user.getUsername() : loginRequestDTO.getUsername())
                .email(user != null ? user.getEmail() : null)
                .build();
    }

    public UserDTO register(RegisterRequestDTO registerRequestDTO) {
        try {

            ResponseEntity<Boolean> usernameExists = userServiceClient
                    .existsByUsername(registerRequestDTO.getUsername());
            if (usernameExists.getBody() != null && usernameExists.getBody()) {
                throw new IllegalArgumentException("Username already exists");
            }

            ResponseEntity<Boolean> emailExists = userServiceClient
                    .existsByEmail(registerRequestDTO.getEmail());
            if (emailExists.getBody() != null && emailExists.getBody()) {
                throw new IllegalArgumentException("Email already exists");
            }

            ResponseEntity<UserDTO> registerUser = userServiceClient.registerUser(registerRequestDTO);
            return registerUser.getBody();
        } catch (Exception e) {
            log.error("Register failed: {}", e.getMessage());
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
            return response.getBody();
        } catch (FeignException e) {
            log.error("Error getting user: {}", e.getMessage());
            return null;
        }
    }
}
