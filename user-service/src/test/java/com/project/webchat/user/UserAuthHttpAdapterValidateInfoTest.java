package com.project.webchat.user;

import com.project.webchat.shared.dto.CredentialsDTO;
import com.project.webchat.shared.dto.RegisterRequestDTO;
import com.project.webchat.shared.dto.UserCredentialsResponse;
import com.project.webchat.shared.security.GatewayAuthHeaders;
import com.project.webchat.user.repository.UserRepository;
import com.project.webchat.user.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class UserAuthHttpAdapterValidateInfoTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @Value("${gateway.internal-auth-token:local-gateway-token}")
    private String gatewayAuthToken;

    @BeforeEach
    void clean() {
        userRepository.deleteAll();
    }

    @Test
    void validateAndGetInfo_usesServiceResponse_includingIsActive() throws Exception {
        userService.registerUser(RegisterRequestDTO.builder()
                .username("validuser")
                .email("valid@example.com")
                .password("pass123")
                .phoneNumber("+15551112222")
                .countryCode("US")
                .build());

        UserCredentialsResponse fromService = userService.validateAndGetUserInfo("validuser", "pass123");
        assertThat(fromService.isValid()).isTrue();
        assertThat(fromService.isActive()).isTrue();

        String body = objectMapper.writeValueAsString(CredentialsDTO.builder()
                .username("validuser")
                .password("pass123")
                .build());

        String response = mockMvc.perform(post("/api/users/validate-and-get-info")
                        .header(GatewayAuthHeaders.GATEWAY_AUTH, gatewayAuthToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();

        UserCredentialsResponse fromHttp = objectMapper.readValue(response, UserCredentialsResponse.class);
        assertThat(fromHttp.getId()).isEqualTo(fromService.getId());
        assertThat(fromHttp.getUsername()).isEqualTo(fromService.getUsername());
        assertThat(fromHttp.getEmail()).isEqualTo(fromService.getEmail());
        assertThat(fromHttp.isValid()).isEqualTo(fromService.isValid());
        assertThat(fromHttp.isActive()).isEqualTo(fromService.isActive());
    }

    @Test
    void validateAndGetInfo_returns401WhenCredentialsInvalid() throws Exception {
        String body = objectMapper.writeValueAsString(CredentialsDTO.builder()
                .username("missing")
                .password("nope")
                .build());

        mockMvc.perform(post("/api/users/validate-and-get-info")
                        .header(GatewayAuthHeaders.GATEWAY_AUTH, gatewayAuthToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void validateAndGetInfo_returns401WithoutGatewayAuth() throws Exception {
        String body = objectMapper.writeValueAsString(CredentialsDTO.builder()
                .username("validuser")
                .password("pass123")
                .build());

        mockMvc.perform(post("/api/users/validate-and-get-info")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }
}
