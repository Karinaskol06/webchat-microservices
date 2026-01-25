package com.project.webchat.auth;

import com.project.webchat.auth.feign.UserServiceClient;
import com.project.webchat.auth.feign.UserServiceClientFallback;
import com.project.webchat.auth.repository.AuthUserRepository;
import com.project.webchat.shared.dto.CredentialsDTO;
import com.project.webchat.shared.dto.LoginRequestDTO;
import com.project.webchat.shared.dto.LoginResponseDTO;
import com.project.webchat.shared.dto.RegisterRequestDTO;
import com.project.webchat.shared.dto.UserCredentialsResponse;
import com.project.webchat.shared.dto.UserDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.*;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Transactional
public class AuthIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @MockBean
    private UserServiceClient userServiceClient;

    private String baseUrl;

    @BeforeEach
    void setUp() {
        baseUrl = "http://localhost:" + port + "/api/auth";

        // Setup default mock responses
        when(userServiceClient.existsByUsername(anyString()))
                .thenReturn(ResponseEntity.ok(false));

        when(userServiceClient.existsByEmail(anyString()))
                .thenReturn(ResponseEntity.ok(false));

        when(userServiceClient.registerUser(any(RegisterRequestDTO.class)))
                .thenReturn(ResponseEntity.ok(
                        UserDTO.builder()
                                .id(1L)
                                .username("karinaskol")
                                .email("karinaskol06@gmail.com")
                                .firstName("Karina")
                                .lastName("Skoliboh")
                                .build()
                ));

        when(userServiceClient.validateCredentials(any()))
                .thenReturn(ResponseEntity.ok(true));

        when(userServiceClient.validateAndGetInfo(any(CredentialsDTO.class)))
                .thenReturn(ResponseEntity.ok(
                        UserCredentialsResponse.builder()
                                .id(1L)
                                .username("karinaskol")
                                .password("hashedpassword")
                                .email("karinaskol06@gmail.com")
                                .isValid(true)
                                .isActive(true)
                                .build()
                ));
    }

    @Test
    void testAllAuthFlow_RegisterThenLoginAndValidate() {
        RegisterRequestDTO regRequest = RegisterRequestDTO.builder()
                .username("karinaskol")
                .password("11111")
                .email("karinaskol06@gmail.com")
                .firstName("Karina")
                .lastName("Skoliboh")
                .build();

        ResponseEntity<UserDTO> regResponse = restTemplate.postForEntity(
                baseUrl + "/register", regRequest, UserDTO.class
        );

        assertThat(regResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(regResponse.getBody()).isNotNull();
        assertThat(regResponse.getBody().getUsername()).isEqualTo("karinaskol");

        LoginRequestDTO loginRequest = LoginRequestDTO.builder()
                .username("karinaskol")
                .password("11111")
                .build();

        ResponseEntity<LoginResponseDTO> loginResponse = restTemplate.postForEntity(
                baseUrl + "/login", loginRequest, LoginResponseDTO.class
        );

        assertThat(loginResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(loginResponse.getBody()).isNotNull();
        assertThat(loginResponse.getBody().getUsername()).isEqualTo("karinaskol");
        assertThat(loginResponse.getBody().getToken()).isNotNull();

        String token = loginResponse.getBody().getToken();
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + token);

        ResponseEntity<String> validateResponse = restTemplate.exchange(
                baseUrl + "/validate",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class
        );

        assertThat(validateResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(validateResponse.getBody()).contains("\"valid\":true");
    }

    @Test
    void testLoginWithInvalidCredentials() {
        when(userServiceClient.validateCredentials(any()))
                .thenReturn(ResponseEntity.ok(false));

        LoginRequestDTO logRequest = LoginRequestDTO.builder()
                .username("karinkarin")
                .password("11111")
                .build();

        ResponseEntity<LoginResponseDTO> loginResponse = restTemplate.postForEntity(
                baseUrl + "/login", logRequest, LoginResponseDTO.class
        );

        assertThat(loginResponse.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void testRegisterWithDuplicateUsername() {
        when(userServiceClient.existsByUsername("karinaskol"))
                .thenReturn(ResponseEntity.ok(true));

        RegisterRequestDTO duplicateRequest = RegisterRequestDTO.builder()
                .username("karinaskol")
                .password("111110")
                .email("otherMail@gmail.com")
                .build();

        ResponseEntity<String> regResponse = restTemplate.postForEntity(
                baseUrl + "/register", duplicateRequest, String.class
        );

        assertThat(regResponse.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(regResponse.getBody()).contains("Username already exists");
    }

    @Test
    void testRegisterWithDuplicateEmail() {

        RegisterRequestDTO request = RegisterRequestDTO.builder()
                .username("karinaskol")
                .password("11111")
                .email("existing@email.com")
                .build();

        when(userServiceClient.existsByUsername("karinaskol"))
                .thenReturn(ResponseEntity.ok(false));
        when(userServiceClient.existsByEmail("existing@email.com"))
                .thenReturn(ResponseEntity.ok(true));

        ResponseEntity<String> regResponse = restTemplate.postForEntity(
                baseUrl + "/register", request, String.class
        );

        assertThat(regResponse.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(regResponse.getBody()).contains("Email already exists");
    }
}