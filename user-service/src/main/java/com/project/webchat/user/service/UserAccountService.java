package com.project.webchat.user.service;

import com.project.webchat.shared.dto.DeletedAccountProfile;
import com.project.webchat.shared.dto.RegisterRequestDTO;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.user.dto.DeleteAccountDTO;
import com.project.webchat.user.dto.FieldAvailabilityDTO;
import com.project.webchat.user.dto.UpdateAccountDTO;
import com.project.webchat.user.dto.UpdateAccountResultDTO;
import com.project.webchat.user.entity.User;
import com.project.webchat.shared.exceptions.ResourceNotFoundException;
import com.project.webchat.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional
public class UserAccountService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final UserProfileService userProfileService;
    private final UserAccountDeletionService userAccountDeletionService;

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
        return userProfileService.convertToDTO(savedUser);
    }

    public void deleteAccount(Long userId, String username, DeleteAccountDTO deleteAccountDTO) {
        userAccountDeletionService.deleteAccount(userId, username, deleteAccountDTO);
    }

    public UserDTO buildDeletedUserDTO(Long userId) {
        return UserDTO.builder()
                .id(userId)
                .username(DeletedAccountProfile.usernameForId(userId))
                .active(false)
                .deleted(true)
                .build();
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
                .user(userProfileService.convertToDTO(saved))
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
}
