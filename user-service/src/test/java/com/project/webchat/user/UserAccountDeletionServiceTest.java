package com.project.webchat.user;

import com.project.webchat.shared.dto.DeletedAccountProfile;
import com.project.webchat.user.dto.DeleteAccountDTO;
import com.project.webchat.user.entity.User;
import com.project.webchat.user.feign.ChatServiceClient;
import com.project.webchat.user.repository.FriendRequestRepository;
import com.project.webchat.user.repository.ProfileImageRepository;
import com.project.webchat.user.repository.UserBanRepository;
import com.project.webchat.user.repository.UserContactRepository;
import com.project.webchat.user.repository.UserRepository;
import com.project.webchat.user.service.UserAccountDeletionService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserAccountDeletionServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private UserContactRepository userContactRepository;
    @Mock
    private FriendRequestRepository friendRequestRepository;
    @Mock
    private UserBanRepository userBanRepository;
    @Mock
    private ProfileImageRepository profileImageRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private ChatServiceClient chatServiceClient;

    @Test
    void deleteAccount_cleansRelations_notifiesChat_andAnonymizesUser() {
        UserAccountDeletionService deletionService = new UserAccountDeletionService(
                userRepository,
                userContactRepository,
                friendRequestRepository,
                userBanRepository,
                profileImageRepository,
                passwordEncoder,
                chatServiceClient);
        User user = User.builder()
                .id(42L)
                .username("john")
                .email("john@example.com")
                .passwordHash("hash-old")
                .isActive(true)
                .build();
        DeleteAccountDTO request = DeleteAccountDTO.builder()
                .confirmUsername("john")
                .password("pass123")
                .build();

        when(userRepository.findById(42L)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("pass123", "hash-old")).thenReturn(true);
        when(passwordEncoder.encode(anyString())).thenReturn("hash-new");

        deletionService.deleteAccount(42L, "john", request);

        verify(chatServiceClient).handleAccountDeleted(42L);
        verify(userContactRepository).deleteByUserIdOrContactUserId(42L);
        verify(friendRequestRepository).deleteByFromUserIdOrToUserId(42L);
        verify(userBanRepository).deleteByUserId(42L);
        verify(userBanRepository).deleteByBannedUserId(42L);
        verify(profileImageRepository).deleteByUserId(42L);

        ArgumentCaptor<User> savedUserCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(savedUserCaptor.capture());
        User saved = savedUserCaptor.getValue();
        assertThat(saved.isActive()).isFalse();
        assertThat(saved.getUsername()).isEqualTo(DeletedAccountProfile.usernameForId(42L));
        assertThat(saved.getEmail()).isEqualTo(DeletedAccountProfile.emailForId(42L));
        assertThat(saved.getPasswordHash()).isEqualTo("hash-new");
    }

    @Test
    void deleteAccount_rejectsUsernameMismatch() {
        UserAccountDeletionService deletionService = new UserAccountDeletionService(
                userRepository,
                userContactRepository,
                friendRequestRepository,
                userBanRepository,
                profileImageRepository,
                passwordEncoder,
                chatServiceClient);
        User user = User.builder()
                .id(42L)
                .username("john")
                .passwordHash("hash-old")
                .isActive(true)
                .build();
        DeleteAccountDTO request = DeleteAccountDTO.builder()
                .confirmUsername("jack")
                .password("pass123")
                .build();
        when(userRepository.findById(42L)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> deletionService.deleteAccount(42L, "john", request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("confirmation");
    }
}
