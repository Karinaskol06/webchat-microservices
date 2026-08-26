package com.project.webchat.user.service;

import com.project.webchat.user.dto.ChangePasswordDTO;
import com.project.webchat.user.dto.DeleteAccountDTO;
import com.project.webchat.user.dto.FieldAvailabilityDTO;
import com.project.webchat.user.dto.UpdateAccountDTO;
import com.project.webchat.user.dto.UpdateAccountResultDTO;
import com.project.webchat.shared.dto.RegisterRequestDTO;
import com.project.webchat.shared.dto.UserSearchResultDTO;
import com.project.webchat.user.dto.UpdateUserDTO;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.shared.dto.UserCredentialsResponse;
import com.project.webchat.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.Set;

@RequiredArgsConstructor
@Service
@Transactional
public class UserService {

    private final UserAccountService userAccountService;
    private final UserAuthService userAuthService;
    private final UserProfileService userProfileService;
    private final UserSearchService userSearchService;
    private final UserPresenceService userPresenceService;

    @Transactional
    public UserDTO registerUser(RegisterRequestDTO registerDTO) {
        return userAccountService.registerUser(registerDTO);
    }

    @Transactional
    public UserDTO updateUser(String username, UpdateUserDTO updateUserDTO) {
        return userProfileService.updateUser(username, updateUserDTO);
    }

    @Transactional
    public UserDTO updateUser(String username, UpdateUserDTO updateUserDTO, Set<String> providedFields) {
        return userProfileService.updateUser(username, updateUserDTO, providedFields);
    }

    @Transactional
    public void deleteAccount(Long userId, String username, DeleteAccountDTO deleteAccountDTO) {
        userAccountService.deleteAccount(userId, username, deleteAccountDTO);
    }

    public UserDTO buildDeletedUserDTO(Long userId) {
        return userAccountService.buildDeletedUserDTO(userId);
    }

    @Transactional
    public void changePassword(String username, ChangePasswordDTO changePasswordDTO) {
        userAuthService.changePassword(username, changePasswordDTO);
    }

    public FieldAvailabilityDTO checkUsernameAvailability(String rawUsername, Long userId) {
        return userAccountService.checkUsernameAvailability(rawUsername, userId);
    }

    public FieldAvailabilityDTO checkEmailAvailability(String rawEmail, Long userId) {
        return userAccountService.checkEmailAvailability(rawEmail, userId);
    }

    @Transactional
    public UpdateAccountResultDTO updateAccountIdentifiers(Long userId, UpdateAccountDTO updateAccountDTO) {
        return userAccountService.updateAccountIdentifiers(userId, updateAccountDTO);
    }

    @Transactional
    public void resetPassword(String username, String newPassword) {
        userAuthService.resetPassword(username, newPassword);
    }

    public Optional<UserDTO> findUserByEmail(String email) {
        return userProfileService.findUserByEmail(email);
    }

    public List<UserDTO> getAllUsers() {
        return userProfileService.getAllUsers();
    }

    public UserDTO getUserDTOById(Long userId) {
        return userProfileService.getUserDTOById(userId);
    }

    /** Overwrites last_seen_at only when the new timestamp is newer or missing */
    @Transactional
    public void updateLastSeen(Long userId, long epochMillis) {
        userPresenceService.updateLastSeen(userId, epochMillis);
    }

    @Transactional(readOnly = true)
    public Long getLastSeenEpochMillis(Long userId) {
        return userPresenceService.getLastSeenEpochMillis(userId);
    }

    public UserDTO getUserDTOByUsername(String username) {
        return userProfileService.getUserDTOByUsername(username);
    }

    public Long getUserIdByUsername(String username) {
        return userProfileService.getUserIdByUsername(username);
    }

    public boolean existsByUsername(String username) {
        return userProfileService.existsByUsername(username);
    }

    public boolean existsByEmail(String email) {
        return userProfileService.existsByEmail(email);
    }

    /**
     * Resolves a login field value (username or email) to the canonical username for authentication.
     */
    public Optional<String> resolveUsernameForLogin(String loginIdentifier) {
        return userAuthService.resolveUsernameForLogin(loginIdentifier);
    }

    public boolean validateCredentials(String username, String password) {
        return userAuthService.validateCredentials(username, password);
    }

    public UserCredentialsResponse validateAndGetUserInfo(String username, String password) {
        return userAuthService.validateAndGetUserInfo(username, password);
    }

    public UserCredentialsResponse getUserCredentialsByUsername(String username) {
        return userAuthService.getUserCredentialsByUsername(username);
    }

    public Page<UserSearchResultDTO> searchUsers(String rawQuery, Long currentUserId, Pageable pageable) {
        return userSearchService.searchUsers(rawQuery, currentUserId, pageable);
    }

    public UserDTO convertToDTO(User user) {
        return userProfileService.convertToDTO(user);
    }
}
