package com.project.webchat.auth;

import com.project.webchat.auth.entity.AuthUser;
import com.project.webchat.auth.security.CustomUserDetails;
import com.project.webchat.auth.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@TestPropertySource(locations = "classpath:application-test.yml")
@Import(JwtService.class)
public class JwtServiceTest {

    @Autowired
    private JwtService jwtService;

    private UserDetails userDetails;

    @BeforeEach
    void setUp() {
        AuthUser authUser = AuthUser.builder()
                .id(1L)
                .username("karinaTest")
                .email("testEmail@example.com")
                .passwordHash("encodedPass")
                .userServiceId(100L)
                .active(true)
                .build();

        userDetails = new CustomUserDetails(authUser);
    }

    @Test
    void testGenerateAndValidateToken() {
        System.out.println("Testing token generation...");

        String token = jwtService.generateToken(userDetails);

        System.out.println("Token generated: " + (token != null ? "Yes" : "No"));
        if (token != null) {
            System.out.println("Token length: " + token.length());
        }

        assertThat(token).isNotBlank();

        assertThat(jwtService.validateToken(token)).isTrue();
        assertThat(jwtService.extractUsername(token)).isEqualTo("karinaTest");
        assertThat(jwtService.extractUserServiceId(token)).isEqualTo(100L);
        assertThat(jwtService.extractUserId(token)).isEqualTo(1L);
    }

    @Test
    void testInvalidToken() {
        String invalidToken = "invalidToken";

        assertThat(jwtService.validateToken(invalidToken)).isFalse();
    }
}
