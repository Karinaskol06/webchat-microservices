package com.project.webchat.user;

import com.project.webchat.shared.dto.RegisterRequestDTO;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.user.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class UserServiceFacadeDelegationTest {

    @Autowired
    private UserService userService;

    @Autowired
    private com.project.webchat.user.repository.UserRepository userRepository;

    @BeforeEach
    void clean() {
        userRepository.deleteAll();
    }

    @Test
    void userService_isFacadeOverDeepModules() {
        Set<String> expectedFields = Set.of(
                "userAccountService",
                "userAuthService",
                "userProfileService",
                "userSearchService",
                "userPresenceService");
        Set<String> actualFields = Arrays.stream(UserService.class.getDeclaredFields())
                .map(Field::getName)
                .collect(java.util.stream.Collectors.toSet());

        assertThat(actualFields).containsAll(expectedFields);
        assertThat(actualFields).doesNotContain(
                "userRepository",
                "profileImageRepository",
                "userContactRepository",
                "friendRequestRepository",
                "userBanRepository",
                "passwordEncoder",
                "chatServiceClient");
    }

    @Test
    void registerAndSearch_stillWorksThroughFacade() {
        RegisterRequestDTO request = RegisterRequestDTO.builder()
                .username("john")
                .email("john@example.com")
                .password("pass123")
                .phoneNumber("+15550000000")
                .countryCode("US")
                .build();
        UserDTO created = userService.registerUser(request);

        assertThat(created.getUsername()).isEqualTo("john");
        assertThat(userService.searchUsers("jo", null,
                org.springframework.data.domain.PageRequest.of(0, 10)).getContent())
                .extracting(com.project.webchat.shared.dto.UserSearchResultDTO::getUsername)
                .contains("john");
    }
}
