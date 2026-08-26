package com.project.webchat.user.controller;

import com.project.webchat.shared.dto.CredentialsDTO;
import com.project.webchat.shared.dto.RegisterRequestDTO;
import com.project.webchat.shared.dto.ResetPasswordInternalDTO;
import com.project.webchat.shared.dto.UserCredentialsResponse;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.shared.dto.UserSearchResultDTO;
import com.project.webchat.user.dto.UserSearchPageResponse;
import com.project.webchat.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * HTTP adapter for auth/lookup Feign consumers and user search.
 * Paths remain under /api/users for existing clients.
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Slf4j
public class UserAuthHttpAdapter {

    private final UserService userService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequestDTO registerRequestDTO) {
        try {
            UserDTO registered = userService.registerUser(registerRequestDTO);
            return ResponseEntity.ok(registered);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Registration failed: " + e.getMessage());
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserDTO> getUserById(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserDTOById(id));
    }

    @GetMapping("/by-username/{username}")
    public ResponseEntity<UserDTO> getUserByUsername(@PathVariable String username) {
        log.info("Getting user by username: {}", username);
        try {
            return ResponseEntity.ok(userService.getUserDTOByUsername(username));
        } catch (UsernameNotFoundException e) {
            log.error("User not found: {}", username, e);
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error getting user by username: {}", username, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/by-username/{username}/with-password")
    public ResponseEntity<UserCredentialsResponse> getUserWithPasswordByUsername(
            @PathVariable String username) {
        try {
            return ResponseEntity.ok(userService.getUserCredentialsByUsername(username));
        } catch (UsernameNotFoundException e) {
            log.warn("User not found for credentials lookup: {}", username);
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/exists/username/{username}")
    public ResponseEntity<Boolean> existsUserByUsername(@PathVariable String username) {
        return ResponseEntity.ok(userService.existsByUsername(username));
    }

    @GetMapping("/exists/email/{email}")
    public ResponseEntity<Boolean> existsUserByEmail(@PathVariable String email) {
        return ResponseEntity.ok(userService.existsByEmail(email));
    }

    @GetMapping("/by-email")
    public ResponseEntity<UserDTO> getUserByEmail(@RequestParam("email") String email) {
        return userService.findUserByEmail(email)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/internal/reset-password")
    public ResponseEntity<Void> resetPasswordInternal(
            @Valid @RequestBody ResetPasswordInternalDTO request) {
        try {
            userService.resetPassword(request.getUsername(), request.getNewPassword());
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/resolve-login/{loginIdentifier}")
    public ResponseEntity<String> resolveLoginIdentifier(@PathVariable String loginIdentifier) {
        return userService.resolveUsernameForLogin(loginIdentifier)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/search")
    public ResponseEntity<UserSearchPageResponse> searchUsers(
            @RequestParam("query") String query,
            @RequestHeader(value = "X-User-Id", required = false) String currentUserIdHeader,
            @PageableDefault(size = 20) Pageable pageable) {
        Long currentUserId = parseOptionalUserIdHeader(currentUserIdHeader);
        Page<UserSearchResultDTO> results = userService.searchUsers(query, currentUserId, pageable);
        return ResponseEntity.ok(UserSearchPageResponse.from(results));
    }

    @PostMapping("/validate-credentials")
    public ResponseEntity<Boolean> validateCredentials(@RequestBody CredentialsDTO credentials) {
        boolean isValid = userService.validateCredentials(
                credentials.getUsername(),
                credentials.getPassword());
        return ResponseEntity.ok(isValid);
    }

    @PostMapping("/validate-and-get-info")
    public ResponseEntity<UserCredentialsResponse> validateAndGetUserInfo(
            @RequestBody CredentialsDTO credentials) {
        UserCredentialsResponse response = userService.validateAndGetUserInfo(
                credentials.getUsername(),
                credentials.getPassword());
        if (!response.isValid()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(response);
    }

    private Long parseOptionalUserIdHeader(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException e) {
            log.warn("Ignoring invalid X-User-Id header: {}", raw);
            return null;
        }
    }
}
