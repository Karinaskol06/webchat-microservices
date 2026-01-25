package com.project.webchat.user;

import com.project.webchat.shared.dto.RegisterRequestDTO;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.user.entity.User;
import com.project.webchat.user.repository.UserRepository;
import com.project.webchat.user.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class UserServiceTest {

    @Autowired
    private UserService userService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
    }

    @Test
    void testRegisterUser() {
        RegisterRequestDTO registerRequestDTO = RegisterRequestDTO.builder()
                .username("karinaskol")
                .email("karinaskol@gmail.com")
                .password("11111")
                .firstName("Karina")
                .lastName("Skoliboh")
                .build();

        UserDTO result = userService.registerUser(registerRequestDTO);

        assertThat(result).isNotNull();
        assertThat(result.getUsername()).isEqualTo("karinaskol");
        assertThat(result.getEmail()).isEqualTo("karinaskol@gmail.com");
        assertThat(result.getFirstName()).isEqualTo("Karina");
        assertThat(result.getLastName()).isEqualTo("Skoliboh");

        User savedUser = userRepository.findByUsername("karinaskol").orElseThrow();
        assertThat(savedUser).isNotNull();
        assertThat(passwordEncoder.matches("11111", savedUser.getPasswordHash())).isTrue();
    }

    @Test
    void testRegisterDuplicateUsername() {
        RegisterRequestDTO request1 = RegisterRequestDTO.builder()
                .username("duplicate")
                .password("11111")
                .email("email1@gmail.com")
                .build();

        userService.registerUser(request1);

        RegisterRequestDTO request2 = RegisterRequestDTO.builder()
                .username("duplicate")
                .password("22222")
                .email("email2@gmail.com")
                .build();

        assertThatThrownBy(() -> userService.registerUser(request2))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Username is already in use");
    }

    @Test
    void testValidateCredentials() {
        RegisterRequestDTO regRequest = RegisterRequestDTO.builder()
                .username("karinaskol")
                .email("karinaskol@gmail.com")
                .password("11111")
                .firstName("Karina")
                .lastName("Skoliboh")
                .build();

        userService.registerUser(regRequest);

        boolean valid = userService.validateCredentials("karinaskol", "11111");
        assertThat(valid).isTrue();

        boolean inValid = userService.validateCredentials("karinaskol", "22222");
        assertThat(inValid).isFalse();

        boolean nonExistent = userService.validateCredentials("karinaskoliboh", "11111");
        assertThat(nonExistent).isFalse();
    }

    @Test
    void testGetUserByUsername() {
        RegisterRequestDTO regRequest = RegisterRequestDTO.builder()
                .username("testGet")
                .email("testGet@gmail.com")
                .password("11111")
                .firstName("Karina")
                .lastName("Skoliboh")
                .build();

        UserDTO created = userService.registerUser(regRequest);

        UserDTO found = userService.getUserDTOByUsername("testGet");

        assertThat(found).isNotNull();
        assertThat(found.getUsername()).isEqualTo("testGet");
        assertThat(found.getEmail()).isEqualTo("testGet@gmail.com");
        assertThat(found.getId()).isEqualTo(created.getId());


    }
}
