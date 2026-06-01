package com.project.webchat.auth;

import com.project.webchat.auth.feign.UserServiceClient;
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
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class AuthIntegrationTest {

    private static final String TEST_USERNAME = "karinaskol";
    private static final String TEST_PASSWORD = "secret1";
    private static final String TEST_EMAIL = "karinaskol06@gmail.com";

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @MockBean
    private UserServiceClient userServiceClient;

    private String baseUrl;
    private String passwordHash;

    @BeforeEach
    void setUp() {
        baseUrl = "http://localhost:" + port + "/api/auth";
        passwordHash = new BCryptPasswordEncoder().encode(TEST_PASSWORD);

        when(userServiceClient.existsByUsername(anyString()))
                .thenReturn(ResponseEntity.ok(false));
        when(userServiceClient.existsByEmail(anyString()))
                .thenReturn(ResponseEntity.ok(false));

        when(userServiceClient.registerUser(any(RegisterRequestDTO.class)))
                .thenReturn(ResponseEntity.ok(
                        UserDTO.builder()
                                .id(1L)
                                .username(TEST_USERNAME)
                                .email(TEST_EMAIL)
                                .firstName("Karina")
                                .lastName("Skoliboh")
                                .build()
                ));

        stubUserServiceForLogin();
    }

    private void stubUserServiceForLogin() {
        when(userServiceClient.resolveLoginIdentifier(anyString()))
                .thenAnswer(invocation -> {
                    String identifier = invocation.getArgument(0, String.class);
                    if (identifier == null || identifier.isBlank()) {
                        return ResponseEntity.ok("");
                    }
                    if (TEST_EMAIL.equalsIgnoreCase(identifier)) {
                        return ResponseEntity.ok(TEST_USERNAME);
                    }
                    return ResponseEntity.ok(identifier.trim());
                });

        when(userServiceClient.getUserWithPasswordByUsername(anyString()))
                .thenAnswer(invocation -> {
                    String username = invocation.getArgument(0, String.class);
                    return ResponseEntity.ok(
                            UserCredentialsResponse.builder()
                                    .id(1L)
                                    .username(username)
                                    .password(passwordHash)
                                    .email(TEST_EMAIL)
                                    .isValid(true)
                                    .isActive(true)
                                    .build()
                    );
                });
    }

    @Test
    void registerThenLoginAndValidateToken() {
        RegisterRequestDTO regRequest = RegisterRequestDTO.builder()
                .username(TEST_USERNAME)
                .password(TEST_PASSWORD)
                .email(TEST_EMAIL)
                .phoneNumber("+12025550123")
                .countryCode("US")
                .firstName("Karina")
                .lastName("Skoliboh")
                .build();

        ResponseEntity<UserDTO> regResponse = restTemplate.postForEntity(
                baseUrl + "/register", regRequest, UserDTO.class
        );

        assertThat(regResponse.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(regResponse.getBody()).isNotNull();
        assertThat(regResponse.getBody().getUsername()).isEqualTo(TEST_USERNAME);

        LoginRequestDTO loginRequest = LoginRequestDTO.builder()
                .username(TEST_USERNAME)
                .password(TEST_PASSWORD)
                .build();

        ResponseEntity<LoginResponseDTO> loginResponse = restTemplate.postForEntity(
                baseUrl + "/login", loginRequest, LoginResponseDTO.class
        );

        assertThat(loginResponse.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(loginResponse.getBody()).isNotNull();
        assertThat(loginResponse.getBody().getUsername()).isEqualTo(TEST_USERNAME);
        assertThat(loginResponse.getBody().getToken()).isNotBlank();

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
    void login_withWrongPassword_returnsUnauthorized() {
        LoginRequestDTO logRequest = LoginRequestDTO.builder()
                .username("karinkarin")
                .password("wrongpass")
                .build();

        ResponseEntity<String> loginResponse = restTemplate.postForEntity(
                baseUrl + "/login", logRequest, String.class
        );

        assertThat(loginResponse.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(loginResponse.getBody()).contains("Incorrect password");
    }

    @Test
    void login_withUnknownUser_returnsBadRequest() {
        when(userServiceClient.resolveLoginIdentifier("unknown_user"))
                .thenReturn(ResponseEntity.ok(""));

        LoginRequestDTO logRequest = LoginRequestDTO.builder()
                .username("unknown_user")
                .password(TEST_PASSWORD)
                .build();

        ResponseEntity<String> loginResponse = restTemplate.postForEntity(
                baseUrl + "/login", logRequest, String.class
        );

        assertThat(loginResponse.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(loginResponse.getBody()).contains("User does not exist");
    }

    @Test
    void register_withDuplicateUsername_returnsBadRequest() {
        when(userServiceClient.existsByUsername(TEST_USERNAME))
                .thenReturn(ResponseEntity.ok(true));

        RegisterRequestDTO duplicateRequest = RegisterRequestDTO.builder()
                .username(TEST_USERNAME)
                .password(TEST_PASSWORD)
                .email("otherMail@gmail.com")
                .phoneNumber("+12025550199")
                .countryCode("US")
                .build();

        ResponseEntity<String> regResponse = restTemplate.postForEntity(
                baseUrl + "/register", duplicateRequest, String.class
        );

        assertThat(regResponse.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(regResponse.getBody()).contains("Username already exists");
    }

    @Test
    void register_withDuplicateEmail_returnsBadRequest() {
        when(userServiceClient.existsByUsername(TEST_USERNAME))
                .thenReturn(ResponseEntity.ok(false));
        when(userServiceClient.existsByEmail("existing@email.com"))
                .thenReturn(ResponseEntity.ok(true));

        RegisterRequestDTO request = RegisterRequestDTO.builder()
                .username(TEST_USERNAME)
                .password(TEST_PASSWORD)
                .email("existing@email.com")
                .phoneNumber("+12025550188")
                .countryCode("US")
                .build();

        ResponseEntity<String> regResponse = restTemplate.postForEntity(
                baseUrl + "/register", request, String.class
        );

        assertThat(regResponse.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(regResponse.getBody()).contains("Email already exists");
    }
}
