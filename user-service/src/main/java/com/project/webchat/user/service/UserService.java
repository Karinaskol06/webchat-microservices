package com.project.webchat.user.service;

import com.project.webchat.user.dto.ChangePasswordDTO;
import com.project.webchat.user.dto.DeleteAccountDTO;
import com.project.webchat.user.dto.FieldAvailabilityDTO;
import com.project.webchat.user.dto.UpdateAccountDTO;
import com.project.webchat.user.dto.UpdateAccountResultDTO;
import com.project.webchat.shared.dto.UserSearchResultDTO;
import com.project.webchat.shared.dto.DeletedAccountProfile;
import com.project.webchat.shared.dto.RegisterRequestDTO;
import com.project.webchat.user.dto.UpdateUserDTO;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.shared.dto.UserCredentialsResponse;
import com.project.webchat.user.entity.User;
import com.project.webchat.shared.exceptions.ResourceNotFoundException;
import com.project.webchat.user.feign.ChatServiceClient;
import com.project.webchat.user.repository.FriendRequestRepository;
import com.project.webchat.user.repository.ProfileImageRepository;
import com.project.webchat.user.repository.UserBanRepository;
import com.project.webchat.user.repository.UserContactRepository;
import com.project.webchat.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RequiredArgsConstructor
@Slf4j
@Service
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final ProfileImageRepository profileImageRepository;
    private final UserContactRepository userContactRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final UserBanRepository userBanRepository;
    private final PasswordEncoder passwordEncoder;
    private final ChatServiceClient chatServiceClient;

    @Transactional
    public UserDTO registerUser(RegisterRequestDTO registerDTO) {
        if (userRepository.existsByUsername(registerDTO.getUsername())) {
            throw new IllegalArgumentException("Username is already in use");
        }

        String email = registerDTO.getEmail().trim();
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Email is already in use");
        }

        String phoneNumber = registerDTO.getPhoneNumber().trim();
        String countryCode = registerDTO.getCountryCode().trim().toUpperCase(Locale.ROOT);

        String encodedPassword = passwordEncoder.encode(registerDTO.getPassword());

        User user = User.builder()
                .username(registerDTO.getUsername())
                .firstName(registerDTO.getFirstName())
                .lastName(registerDTO.getLastName())
                .email(email)
                .phoneNumber(phoneNumber)
                .countryCode(countryCode)
                .passwordHash(encodedPassword)
                .isActive(true)
                .build();
        User savedUser = userRepository.save(user);
        userRepository.flush();

        return convertToDTO(savedUser);
    }

    @Transactional
    public UserDTO updateUser(String username, UpdateUserDTO updateUserDTO) {
        return updateUser(username, updateUserDTO, new HashSet<>());
    }

    @Transactional
    public UserDTO updateUser(String username, UpdateUserDTO updateUserDTO, Set<String> providedFields) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found " + username));

        if (providedFields.contains("firstName")) {
            user.setFirstName(updateUserDTO.getFirstName());
        }
        if (providedFields.contains("lastName")) {
            user.setLastName(updateUserDTO.getLastName());
        }
        if (providedFields.contains("description")) {
            user.setDescription(updateUserDTO.getDescription());
        }
        if (providedFields.contains("birthday")) {
            user.setBirthday(updateUserDTO.getBirthday());
        }
        if (providedFields.contains("phoneNumber")) {
            String p = updateUserDTO.getPhoneNumber();
            user.setPhoneNumber(p == null || p.isBlank() ? null : p.trim());
        }
        if (providedFields.contains("countryCode")) {
            String cc = updateUserDTO.getCountryCode();
            user.setCountryCode(cc == null || cc.isBlank() ? null : cc.trim().toUpperCase(Locale.ROOT));
        }

        User savedUser = userRepository.save(user);

        return convertToDTO(savedUser);
    }

    @Transactional
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

    public UserDTO buildDeletedUserDTO(Long userId) {
        return UserDTO.builder()
                .id(userId)
                .username(DeletedAccountProfile.usernameForId(userId))
                .active(false)
                .deleted(true)
                .build();
    }

    @Transactional
    public void changePassword(String username, ChangePasswordDTO changePasswordDTO) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found " + username));
        if (!passwordEncoder.matches(changePasswordDTO.getOldPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Old password is incorrect");
        }
        String newPassword = changePasswordDTO.getNewPassword();
        if (newPassword == null || newPassword.length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters long");
        }
        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("New password must be different from the current password");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    public FieldAvailabilityDTO checkUsernameAvailability(String rawUsername, Long userId) {
        String username = normalizeUsername(rawUsername);
        if (username == null) {
            return FieldAvailabilityDTO.builder()
                    .available(false)
                    .message("Username is required")
                    .build();
        }
        if (username.length() < 3 || username.length() > 50) {
            return FieldAvailabilityDTO.builder()
                    .available(false)
                    .message("Username must be between 3 and 50 characters")
                    .build();
        }
        if (!username.matches("^[a-zA-Z0-9._-]+$")) {
            return FieldAvailabilityDTO.builder()
                    .available(false)
                    .message("Username may only contain letters, numbers, dots, underscores, and hyphens")
                    .build();
        }
        boolean taken = isUsernameTakenByAnotherUser(username, userId);
        return FieldAvailabilityDTO.builder()
                .available(!taken)
                .message(taken ? "This username is already taken" : "Username is available")
                .build();
    }

    public FieldAvailabilityDTO checkEmailAvailability(String rawEmail, Long userId) {
        if (rawEmail == null || rawEmail.isBlank()) {
            return FieldAvailabilityDTO.builder()
                    .available(false)
                    .message("Email is required")
                    .build();
        }
        String email = rawEmail.trim();
        boolean taken = isEmailTakenByAnotherUser(email, userId);
        return FieldAvailabilityDTO.builder()
                .available(!taken)
                .message(taken ? "This email is already in use" : "Email is available")
                .build();
    }

    @Transactional
    public UpdateAccountResultDTO updateAccountIdentifiers(Long userId, UpdateAccountDTO updateAccountDTO) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found " + userId));

        boolean usernameChanged = false;
        boolean emailChanged = false;
        String newUsername = updateAccountDTO.getUsername();
        if (newUsername != null && !newUsername.isBlank()) {
            String normalized = normalizeUsername(newUsername);
            FieldAvailabilityDTO availability = checkUsernameAvailability(normalized, userId);
            if (!availability.isAvailable()) {
                throw new IllegalArgumentException(availability.getMessage());
            }
            if (!normalized.equals(user.getUsername())) {
                user.setUsername(normalized);
                usernameChanged = true;
            }
        }

        String newEmail = updateAccountDTO.getEmail();
        if (newEmail != null && !newEmail.isBlank()) {
            String trimmed = newEmail.trim();
            FieldAvailabilityDTO availability = checkEmailAvailability(trimmed, userId);
            if (!availability.isAvailable()) {
                throw new IllegalArgumentException(availability.getMessage());
            }
            if (!trimmed.equalsIgnoreCase(user.getEmail())) {
                user.setEmail(trimmed);
                emailChanged = true;
            }
        }

        if ((newUsername == null || newUsername.isBlank()) && (newEmail == null || newEmail.isBlank())) {
            throw new IllegalArgumentException("Provide a new username or email to update");
        }
        if (!usernameChanged && !emailChanged) {
            throw new IllegalArgumentException("No changes to save");
        }

        User saved = userRepository.save(user);
        String message = usernameChanged
                ? "Username updated. Sign in again with your new username or email."
                : "Account details updated.";
        return UpdateAccountResultDTO.builder()
                .user(convertToDTO(saved))
                .usernameChanged(usernameChanged)
                .message(message)
                .build();
    }

    private boolean isUsernameTakenByAnotherUser(String username, Long userId) {
        return userRepository.findByUsername(username)
                .filter(existing -> !existing.getId().equals(userId))
                .isPresent();
    }

    private boolean isEmailTakenByAnotherUser(String email, Long userId) {
        return userRepository.findByEmailIgnoreCase(email.trim())
                .filter(existing -> !existing.getId().equals(userId))
                .isPresent();
    }

    private static String normalizeUsername(String rawUsername) {
        if (rawUsername == null) {
            return null;
        }
        return rawUsername.trim();
    }

    @Transactional
    public void resetPassword(String username, String newPassword) {
        if (newPassword == null || newPassword.length() < 6) {
            throw new IllegalArgumentException("Password must be at least 6 characters long");
        }
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found " + username));
        if (!user.isActive()) {
            throw new IllegalArgumentException("Account is not active");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    public Optional<UserDTO> findUserByEmail(String email) {
        if (email == null || email.isBlank()) {
            return Optional.empty();
        }
        return userRepository.findByEmailIgnoreCase(email.trim())
                .map(this::convertToDTO);
    }

    public List<UserDTO> getAllUsers() {
        List<User> users = userRepository.findAll();
        return users.stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public UserDTO getUserDTOById(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found " + userId));
        if (!user.isActive()) {
            return buildDeletedUserDTO(userId);
        }
        return convertToDTO(user);
    }

    public UserDTO getUserDTOByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with username" + username));
        if (!user.isActive()) {
            return buildDeletedUserDTO(user.getId());
        }
        return convertToDTO(user);
    }

    public Long getUserIdByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found" + username));
        return user.getId();
    }

    public boolean existsByUsername(String username) {
        return userRepository.existsByUsername(username);
    }

    public boolean existsByEmail(String email) {
        if (email == null || email.isBlank()) {
            return false;
        }
        return userRepository.existsByEmail(email.trim());
    }

    /**
     * Resolves a login field value (username or email) to the canonical username for authentication.
     */
    public Optional<String> resolveUsernameForLogin(String loginIdentifier) {
        if (loginIdentifier == null || loginIdentifier.isBlank()) {
            return Optional.empty();
        }
        String normalized = loginIdentifier.trim();
        if (looksLikeEmail(normalized)) {
            //get username from returned user, otherwise return empty
            return userRepository.findByEmailIgnoreCase(normalized).map(User::getUsername);
        }
        return userRepository.findByUsername(normalized).map(User::getUsername);
    }

    private static boolean looksLikeEmail(String value) {
        return value.contains("@");
    }

    public boolean validateCredentials(String username, String password) {
        try {
            User user = userRepository.findByUsername(username)
                    .orElseThrow(() -> new ResourceNotFoundException("User not found " + username));
            if (!user.isActive()) {
                return false;
            }

            return passwordEncoder.matches(password, user.getPasswordHash());
        } catch (ResourceNotFoundException e) {
            return false;
        }
    }

    public UserCredentialsResponse validateAndGetUserInfo(String username, String password) {
        boolean isValid = validateCredentials(username, password);
        if (!isValid) {
            return UserCredentialsResponse.builder()
                    .isValid(false)
                    .build();
        }
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found " + username));

        return UserCredentialsResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .isValid(true)
                .isActive(user.isActive())
                .build();
    }

    public UserCredentialsResponse getUserCredentialsByUsername(String username) {
        log.info("Getting user credentials by username: {}", username);

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));
        if (!user.isActive()) {
            throw new UsernameNotFoundException("User not found: " + username);
        }

        return UserCredentialsResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .password(user.getPasswordHash())
                .email(user.getEmail())
                .isActive(user.isActive())
                .isValid(true)
                .build();
    }

    public Page<UserSearchResultDTO> searchUsers(String rawQuery, Long currentUserId, Pageable pageable) {
        String query = rawQuery == null ? "" : rawQuery.trim();
        if (query.length() < 2) {
            throw new IllegalArgumentException("Search query must be at least 2 characters long");
        }

        Page<User> searchPage = currentUserId == null
                ? userRepository.findByUsernameStartingWithIgnoreCaseAndIsActiveTrue(query, pageable)
                : userRepository.findByIdNotAndUsernameStartingWithIgnoreCaseAndIsActiveTrue(
                        currentUserId, query, pageable);

        return searchPage.map(this::toSearchResultDTO);
    }

    public UserDTO convertToDTO(User user) {
        if (!user.isActive()) {
            return buildDeletedUserDTO(user.getId());
        }
        return UserDTO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .profilePicture(resolveAvatarPictureUrl(user.getId()))
                .backgroundPicture(resolveBackgroundPictureUrl(user.getId()))
                .description(user.getDescription())
                .birthday(user.getBirthday())
                .phoneNumber(user.getPhoneNumber())
                .countryCode(user.getCountryCode())
                .active(true)
                .deleted(false)
                .build();
    }

    private String resolveAvatarPictureUrl(Long userId) {
        if (!profileImageRepository.existsByUserIdAndKind(userId, ProfileImageService.KIND_AVATAR)) {
            return null;
        }
        return "/api/users/" + userId + "/avatar";
    }

    private String resolveBackgroundPictureUrl(Long userId) {
        if (!profileImageRepository.existsByUserIdAndKind(userId, ProfileImageService.KIND_BACKGROUND)) {
            return null;
        }
        return "/api/users/" + userId + "/background";
    }

    private UserSearchResultDTO toSearchResultDTO(User user) {
        return UserSearchResultDTO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .displayName(resolveDisplayName(user))
                .avatar(resolveAvatarPictureUrl(user.getId()))
                .build();
    }

    private String resolveDisplayName(User user) {
        String firstName = user.getFirstName() == null ? "" : user.getFirstName().trim();
        String lastName = user.getLastName() == null ? "" : user.getLastName().trim();
        String fullName = (firstName + " " + lastName).trim();
        if (!fullName.isEmpty()) {
            return fullName;
        }
        return user.getUsername() == null ? "" : user.getUsername().toLowerCase(Locale.ROOT);
    }
}
