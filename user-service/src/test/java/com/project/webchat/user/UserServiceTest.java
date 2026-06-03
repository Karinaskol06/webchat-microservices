package com.project.webchat.user;

import com.project.webchat.shared.dto.RegisterRequestDTO;
import com.project.webchat.shared.dto.UserSearchResultDTO;
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

import java.util.List;

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
                .phoneNumber("+48572579928")
                .countryCode("PL")
                .firstName("Karina")
                .lastName("Skoliboh")
                .build();

        UserDTO result = userService.registerUser(registerRequestDTO);

        assertThat(result).isNotNull();
        assertThat(result.getUsername()).isEqualTo("karinaskol");
        assertThat(result.getEmail()).isEqualTo("karinaskol@gmail.com");
        assertThat(result.getFirstName()).isEqualTo("Karina");
        assertThat(result.getLastName()).isEqualTo("Skoliboh");
        assertThat(result.getPhoneNumber()).isEqualTo("+15551234567");
        assertThat(result.getCountryCode()).isEqualTo("US");

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
                .phoneNumber("+48572579928")
                .countryCode("PL")
                .build();

        userService.registerUser(request1);

        RegisterRequestDTO request2 = RegisterRequestDTO.builder()
                .username("duplicate")
                .password("22222")
                .email("email2@gmail.com")
                .phoneNumber("+48572579928")
                .countryCode("PL")
                .build();

        assertThatThrownBy(() -> userService.registerUser(request2))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Username is already in use");
    }

    @Test
    void resolveUsernameForLogin_byUsername() {
        registerSampleUser();

        assertThat(userService.resolveUsernameForLogin("karinaskol"))
                .contains("karinaskol");
        assertThat(userService.resolveUsernameForLogin("  karinaskol  "))
                .contains("karinaskol");
    }

    @Test
    void resolveUsernameForLogin_byEmail() {
        registerSampleUser();

        assertThat(userService.resolveUsernameForLogin("karinaskol@gmail.com"))
                .contains("karinaskol");
        assertThat(userService.resolveUsernameForLogin("Karinaskol@Gmail.com"))
                .contains("karinaskol");
    }

    @Test
    void resolveUsernameForLogin_unknownIdentifier() {
        assertThat(userService.resolveUsernameForLogin("nobody"))
                .isEmpty();
        assertThat(userService.resolveUsernameForLogin("missing@example.com"))
                .isEmpty();
        assertThat(userService.resolveUsernameForLogin(""))
                .isEmpty();
    }

    private void registerSampleUser() {
        userService.registerUser(RegisterRequestDTO.builder()
                .username("karinaskol")
                .email("karinaskol@gmail.com")
                .password("11111")
                .phoneNumber("+48572579928")
                .countryCode("PL")
                .firstName("Karina")
                .lastName("Skoliboh")
                .build());
    }

    @Test
    void testValidateCredentials() {
        RegisterRequestDTO regRequest = RegisterRequestDTO.builder()
                .username("karinaskol")
                .email("karinaskol@gmail.com")
                .password("11111")
                .phoneNumber("+48572579928")
                .countryCode("PL")
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
                .phoneNumber("+48572579928")
                .countryCode("PL")
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

    @Test
    void testSearchUsersFiltersByPrefixAndExcludesCurrentUser() {
        userService.registerUser(RegisterRequestDTO.builder()
                .username("alice")
                .email("alice@gmail.com")
                .password("11111")
                .phoneNumber("+48572579928")
                .countryCode("PL")
                .build());
        UserDTO alex = userService.registerUser(RegisterRequestDTO.builder()
                .username("alex")
                .email("alex@gmail.com")
                .password("11111")
                .phoneNumber("+15552222222")
                .countryCode("US")
                .build());
        userService.registerUser(RegisterRequestDTO.builder()
                .username("bob")
                .email("bob@gmail.com")
                .password("11111")
                .phoneNumber("+15553333333")
                .countryCode("US")
                .build());

        List<UserSearchResultDTO> searchResults = userService
                .searchUsers("al", alex.getId(), org.springframework.data.domain.PageRequest.of(0, 20))
                .getContent();

        assertThat(searchResults).extracting(UserSearchResultDTO::getUsername)
                .contains("alice")
                .doesNotContain("alex", "bob");
    }

    @Test
    void testSearchUsersRejectsShortQuery() {
        assertThatThrownBy(() -> userService.searchUsers("a", null,
                org.springframework.data.domain.PageRequest.of(0, 20)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("at least 2 characters");
    }

    @Test
    void resetPassword_updatesStoredHash() {
        userService.registerUser(RegisterRequestDTO.builder()
                .username("resetuser")
                .email("reset@example.com")
                .password("oldpass1")
                .phoneNumber("+15551111111")
                .countryCode("US")
                .build());

        userService.resetPassword("resetuser", "newpass2");

        User user = userRepository.findByUsername("resetuser").orElseThrow();
        assertThat(passwordEncoder.matches("newpass2", user.getPasswordHash())).isTrue();
        assertThat(passwordEncoder.matches("oldpass1", user.getPasswordHash())).isFalse();
    }

    @Test
    void checkUsernameAvailability_allowsCurrentUser() {
        userService.registerUser(RegisterRequestDTO.builder()
                .username("availuser")
                .email("avail@example.com")
                .password("pass123")
                .phoneNumber("+15553334444")
                .countryCode("US")
                .build());
        Long userId = userRepository.findByUsername("availuser").orElseThrow().getId();

        assertThat(userService.checkUsernameAvailability("availuser", userId).isAvailable()).isTrue();
        assertThat(userService.checkUsernameAvailability("takenuser", userId).isAvailable()).isTrue();

        userService.registerUser(RegisterRequestDTO.builder()
                .username("takenuser")
                .email("taken@example.com")
                .password("pass123")
                .phoneNumber("+15553335555")
                .countryCode("US")
                .build());

        assertThat(userService.checkUsernameAvailability("takenuser", userId).isAvailable()).isFalse();
    }

    @Test
    void updateAccountIdentifiers_changesEmailAndUsername() {
        userService.registerUser(RegisterRequestDTO.builder()
                .username("oldname")
                .email("old@example.com")
                .password("pass123")
                .phoneNumber("+15554445555")
                .countryCode("US")
                .build());
        Long userId = userRepository.findByUsername("oldname").orElseThrow().getId();

        var result = userService.updateAccountIdentifiers(userId,
                com.project.webchat.user.dto.UpdateAccountDTO.builder()
                        .username("newname")
                        .email("new@example.com")
                        .build());

        assertThat(result.isUsernameChanged()).isTrue();
        assertThat(result.getUser().getUsername()).isEqualTo("newname");
        assertThat(result.getUser().getEmail()).isEqualTo("new@example.com");
        assertThat(userService.validateCredentials("newname", "pass123")).isTrue();
        assertThat(userService.resolveUsernameForLogin("new@example.com"))
                .contains("newname");
    }

    @Test
    void findUserByEmail_isCaseInsensitive() {
        userService.registerUser(RegisterRequestDTO.builder()
                .username("emailuser")
                .email("FindMe@Example.com")
                .password("pass123")
                .phoneNumber("+15552222222")
                .countryCode("US")
                .build());

        assertThat(userService.findUserByEmail("findme@example.com"))
                .isPresent()
                .get()
                .extracting(UserDTO::getUsername)
                .isEqualTo("emailuser");
    }
}
