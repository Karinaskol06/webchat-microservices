package com.project.webchat.user.service;

import com.project.webchat.user.dto.ChangePasswordDTO;
import com.project.webchat.shared.dto.RegisterRequestDTO;
import com.project.webchat.user.dto.UpdateUserDTO;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.shared.dto.UserCredentialsResponse;
import com.project.webchat.user.entity.User;
import com.project.webchat.shared.exceptions.ResourceNotFoundException;
import com.project.webchat.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@RequiredArgsConstructor
@Slf4j
@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public UserDTO registerUser(RegisterRequestDTO registerDTO) {
        if (userRepository.existsByUsername(registerDTO.getUsername())) {
            throw new IllegalArgumentException("Username is already in use");
        }

        if(userRepository.existsByEmail(registerDTO.getEmail())) {
            throw new IllegalArgumentException("Email is already in use");
        }

        String encodedPassword = passwordEncoder.encode(registerDTO.getPassword());

        User user = User.builder()
                .username(registerDTO.getUsername())
                .firstName(registerDTO.getFirstName())
                .lastName(registerDTO.getLastName())
                .email(registerDTO.getEmail())
                .passwordHash(encodedPassword)
                .build();
        User savedUser = userRepository.save(user);

        return convertToDTO(savedUser);
    }

    @Transactional
    public UserDTO updateUser(String username, UpdateUserDTO updateUserDTO) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found " + username));

        if (updateUserDTO.getUsername() != null && !updateUserDTO.getUsername().equals(user.getUsername())) {
            if (userRepository.existsByUsername(updateUserDTO.getUsername())) {
                throw new IllegalArgumentException("Username is already in use");
            }
            user.setUsername(updateUserDTO.getUsername());
        }

        if (updateUserDTO.getEmail() != null && !updateUserDTO.getEmail().equals(user.getEmail())) {
            if (userRepository.existsByEmail(updateUserDTO.getEmail())) {
                throw new IllegalArgumentException("Email is already in use");
            }
            user.setEmail(updateUserDTO.getEmail());
        }

        if (updateUserDTO.getFirstName() != null) {
            user.setFirstName(updateUserDTO.getFirstName());
        }
        if (updateUserDTO.getLastName() != null) {
            user.setLastName(updateUserDTO.getLastName());
        }

        User savedUser = userRepository.save(user);

        return convertToDTO(savedUser);
    }

    @Transactional
    public void changePassword(String username, ChangePasswordDTO changePasswordDTO) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found " + username));
        if (!passwordEncoder.matches(changePasswordDTO.getOldPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Old password is incorrect");
        }
        if (changePasswordDTO.getOldPassword() != null) {
            user.setPasswordHash(passwordEncoder.encode(changePasswordDTO.getNewPassword()));
        }
        userRepository.save(user);
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
        return convertToDTO(user);
    }

    public UserDTO getUserDTOByUsername(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found " + username));
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
        return userRepository.existsByEmail(email);
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

    public UserDTO convertToDTO(User user) {
        return UserDTO.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .build();
    }
}
