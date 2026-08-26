package com.project.webchat.user.service;

import com.project.webchat.shared.dto.DeletedAccountProfile;
import com.project.webchat.shared.exceptions.ResourceNotFoundException;
import com.project.webchat.user.dto.DeleteAccountDTO;
import com.project.webchat.user.entity.User;
import com.project.webchat.user.feign.ChatServiceClient;
import com.project.webchat.user.repository.FriendRequestRepository;
import com.project.webchat.user.repository.ProfileImageRepository;
import com.project.webchat.user.repository.UserBanRepository;
import com.project.webchat.user.repository.UserContactRepository;
import com.project.webchat.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class UserAccountDeletionService {

    private final UserRepository userRepository;
    private final UserContactRepository userContactRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final UserBanRepository userBanRepository;
    private final ProfileImageRepository profileImageRepository;
    private final PasswordEncoder passwordEncoder;
    private final ChatServiceClient chatServiceClient;

    public void deleteAccount(Long userId, String username, DeleteAccountDTO deleteAccountDTO) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found " + userId));
        if (!user.isActive()) {
            throw new IllegalArgumentException("Account is already deleted");
        }
        if (!user.getUsername().equalsIgnoreCase(username.trim())) {
            throw new IllegalArgumentException("Session user mismatch");
        }

        String confirmUsername = deleteAccountDTO.getConfirmUsername() == null
                ? ""
                : deleteAccountDTO.getConfirmUsername().trim();
        if (!user.getUsername().equalsIgnoreCase(confirmUsername)) {
            throw new IllegalArgumentException("Username confirmation does not match");
        }
        if (!passwordEncoder.matches(deleteAccountDTO.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Password is incorrect");
        }

        chatServiceClient.handleAccountDeleted(userId);
        cleanupUserRelations(userId);
        anonymizeDeletedUser(user);
        log.info("Account deleted for user {}", userId);
    }

    private void cleanupUserRelations(Long userId) {
        userContactRepository.deleteByUserIdOrContactUserId(userId);
        friendRequestRepository.deleteByFromUserIdOrToUserId(userId);
        userBanRepository.deleteByUserId(userId);
        userBanRepository.deleteByBannedUserId(userId);
        profileImageRepository.deleteByUserId(userId);
    }

    private void anonymizeDeletedUser(User user) {
        Long id = user.getId();
        user.setActive(false);
        user.setUsername(DeletedAccountProfile.usernameForId(id));
        user.setEmail(DeletedAccountProfile.emailForId(id));
        user.setFirstName(null);
        user.setLastName(null);
        user.setDescription(null);
        user.setBirthday(null);
        user.setPhoneNumber(null);
        user.setCountryCode(null);
        user.setProfilePicture(null);
        user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        userRepository.save(user);
    }
}
