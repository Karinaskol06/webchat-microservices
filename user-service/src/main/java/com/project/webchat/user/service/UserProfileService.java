package com.project.webchat.user.service;

import com.project.webchat.shared.dto.DeletedAccountProfile;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.shared.exceptions.ResourceNotFoundException;
import com.project.webchat.user.dto.UpdateUserDTO;
import com.project.webchat.user.entity.User;
import com.project.webchat.user.repository.ProfileImageRepository;
import com.project.webchat.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class UserProfileService {

    private final UserRepository userRepository;
    private final ProfileImageRepository profileImageRepository;

    public UserDTO updateUser(String username, UpdateUserDTO updateUserDTO) {
        return updateUser(username, updateUserDTO, new HashSet<>());
    }

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

    public Optional<UserDTO> findUserByEmail(String email) {
        if (email == null || email.isBlank()) {
            return Optional.empty();
        }
        return userRepository.findByEmailIgnoreCase(email.trim())
                .map(this::convertToDTO);
    }

    public List<UserDTO> getAllUsers() {
        return userRepository.findAll().stream()
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

    public UserDTO buildDeletedUserDTO(Long userId) {
        return UserDTO.builder()
                .id(userId)
                .username(DeletedAccountProfile.usernameForId(userId))
                .active(false)
                .deleted(true)
                .build();
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

    public String resolveAvatarPictureUrl(Long userId) {
        if (!profileImageRepository.existsByUserIdAndKind(userId, ProfileImageService.KIND_AVATAR)) {
            return null;
        }
        return "/api/users/" + userId + "/avatar";
    }

    public String resolveBackgroundPictureUrl(Long userId) {
        if (!profileImageRepository.existsByUserIdAndKind(userId, ProfileImageService.KIND_BACKGROUND)) {
            return null;
        }
        return "/api/users/" + userId + "/background";
    }

    public String resolveDisplayName(User user) {
        String firstName = user.getFirstName() == null ? "" : user.getFirstName().trim();
        String lastName = user.getLastName() == null ? "" : user.getLastName().trim();
        String fullName = (firstName + " " + lastName).trim();
        if (!fullName.isEmpty()) {
            return fullName;
        }
        return user.getUsername() == null ? "" : user.getUsername().toLowerCase(Locale.ROOT);
    }
}
