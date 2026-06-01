package com.project.webchat.auth.service;

import com.project.webchat.auth.feign.UserServiceClient;
import com.project.webchat.auth.security.CustomUserDetails;
import com.project.webchat.auth.security.JwtService;
import com.project.webchat.shared.dto.LoginRequestDTO;
import com.project.webchat.shared.dto.LoginResponseDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final String TEST_SECRET =
            "4A404E635266556A586E3272357538782F413F4428472B4B6150645367566B59";

    // fake implementations to isolate auth-service
    @Mock
    private UserServiceClient userServiceClient;

    @Mock
    private AuthenticationManager authenticationManager;

    private JwtService jwtService;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        jwtService = new JwtService();
        // manual configurations
        ReflectionTestUtils.setField(jwtService, "secretKey", TEST_SECRET);
        ReflectionTestUtils.setField(jwtService, "jwtExpiration", 3_600_000L);
        authService = new AuthService(jwtService, userServiceClient, authenticationManager);
    }

    @Test
    void login_success_returnsBearerTokenAndUserFields() {
        LoginRequestDTO request = LoginRequestDTO.builder()
                .username("karina@example.com")
                .password("secret1")
                .build();

        // mocks user service client to return this username as resolved
        when(userServiceClient.resolveLoginIdentifier("karina@example.com"))
                .thenReturn(ResponseEntity.ok("karina"));

        // spring security principal
        CustomUserDetails principal = CustomUserDetails.builder()
                .id(10L)
                .username("karina")
                .email("karina@example.com")
                .passwordHash("hash")
                .active(true)
                .build();

        UsernamePasswordAuthenticationToken authenticated = new UsernamePasswordAuthenticationToken(
                principal, null, List.of());
        // mocks auth manager to return auth token containing this principal
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenReturn(authenticated);

        LoginResponseDTO response = authService.login(request);

        // verify that the token is not blank, valid, type "Bearer" and username/email/id match
        assertThat(response.getToken()).isNotBlank();
        assertThat(jwtService.validateToken(response.getToken())).isTrue();
        assertThat(response.getType()).isEqualTo("Bearer");
        assertThat(response.getUsername()).isEqualTo("karina");
        assertThat(response.getEmail()).isEqualTo("karina@example.com");
        assertThat(response.getId()).isEqualTo(10L);

        // verify auth manager was called with correct username + password
        verify(authenticationManager).authenticate(
                new UsernamePasswordAuthenticationToken("karina", "secret1"));
    }

    @Test
    void login_rejectsPasswordShorterThanSixCharacters() {
        LoginRequestDTO request = LoginRequestDTO.builder()
                .username("karina")
                .password("12345")
                .build();

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least 6 characters");
    }

    @Test
    void login_unknownIdentifier_throwsUserDoesNotExist() {
        // mock feign client to return empty response
        when(userServiceClient.resolveLoginIdentifier("ghost"))
                .thenReturn(ResponseEntity.ok(""));

        LoginRequestDTO request = LoginRequestDTO.builder()
                .username("ghost")
                .password("secret1")
                .build();

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("User does not exist");
    }

    @Test
    void login_wrongPassword_throwsBadCredentials() {
        when(userServiceClient.resolveLoginIdentifier("karina"))
                .thenReturn(ResponseEntity.ok("karina"));
        // mock auth manager to deny authentication
        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class)))
                .thenThrow(new BadCredentialsException("bad"));

        LoginRequestDTO request = LoginRequestDTO.builder()
                .username("karina")
                .password("wrongpass")
                .build();

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(BadCredentialsException.class)
                .hasMessage("Incorrect password");
    }
}
