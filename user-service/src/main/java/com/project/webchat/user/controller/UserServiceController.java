package com.project.webchat.user.controller;

import com.project.webchat.shared.dto.RegisterRequestDTO;
import com.project.webchat.shared.dto.ContactRequestCreateDTO;
import com.project.webchat.shared.dto.ContactStatusDTO;
import com.project.webchat.shared.dto.UserSearchResultDTO;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.shared.dto.CredentialsDTO;
import com.project.webchat.shared.dto.UserCredentialsResponse;
import com.project.webchat.user.entity.FriendRequest;
import com.project.webchat.user.service.ContactService;
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
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Slf4j
public class UserServiceController {
    //endpoints for feign calls

    private final UserService userService;
    private final ContactService contactService;

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
        UserDTO user = userService.getUserDTOById(id);
        return ResponseEntity.ok(user);
    }

    @GetMapping("/by-username/{username}")
    public ResponseEntity<UserDTO> getUserByUsername(@PathVariable String username) {
        log.info("Getting user by username: {}", username);
        try {
            UserDTO user = userService.getUserDTOByUsername(username);
            return ResponseEntity.ok(user);
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
        UserCredentialsResponse user = userService.getUserCredentialsByUsername(username);
        return ResponseEntity.ok(user);
    }

    @GetMapping("/exists/username/{username}")
    public ResponseEntity<Boolean> existsUserByUsername(@PathVariable String username) {
        boolean exists = userService.existsByUsername(username);
        return ResponseEntity.ok(exists);
    }

    @GetMapping("/exists/email/{email}")
    public ResponseEntity<Boolean> existsUserByEmail(@PathVariable String email) {
        boolean exists = userService.existsByEmail(email);
        return ResponseEntity.ok(exists);
    }

    @GetMapping("/search")
    public ResponseEntity<Page<UserSearchResultDTO>> searchUsers(
            @RequestParam("query") String query,
            @RequestHeader(value = "X-User-Id", required = false) Long currentUserId,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<UserSearchResultDTO> results = userService.searchUsers(query, currentUserId, pageable);
        return ResponseEntity.ok(results);
    }

    @PostMapping("/validate-credentials")
    public ResponseEntity<Boolean> validateCredentials(
            @RequestBody CredentialsDTO credentials) {
        boolean isValid = userService.validateCredentials(
                credentials.getUsername(),
                credentials.getPassword());
        return ResponseEntity.ok(isValid);
    }

    @PostMapping("/validate-and-get-info")
    public ResponseEntity<UserCredentialsResponse> validateAndGetUserInfo(
            @RequestBody CredentialsDTO credentials){
        boolean isValid = userService.validateCredentials(
                credentials.getUsername(),
                credentials.getPassword());
        if (!isValid) {
            return ResponseEntity.status(401).build();
        }

        UserDTO user = userService.getUserDTOByUsername(credentials.getUsername());
        UserCredentialsResponse response = UserCredentialsResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .isValid(true)
                .isActive(true)
                .build();

        return ResponseEntity.ok(response);
    }

    @PostMapping("/contacts/requests")
    public ResponseEntity<FriendRequest> createContactRequest(
            @RequestHeader("X-User-Id") Long currentUserId,
            @RequestBody ContactRequestCreateDTO requestDTO) {
        FriendRequest request = contactService.createPendingRequestIfEligible(currentUserId, requestDTO.getToUserId());
        if (request == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(request);
    }

    @PostMapping("/internal/contacts/requests")
    public ResponseEntity<FriendRequest> createContactRequestInternal(
            @RequestBody ContactRequestCreateDTO requestDTO) {
        FriendRequest request = contactService.createPendingRequestIfEligible(
                requestDTO.getFromUserId(), requestDTO.getToUserId());
        if (request == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(request);
    }

    @GetMapping("/contacts/requests/incoming")
    public ResponseEntity<java.util.List<FriendRequest>> getIncomingRequests(
            @RequestHeader("X-User-Id") Long currentUserId) {
        return ResponseEntity.ok(contactService.getIncomingPendingRequests(currentUserId));
    }

    @PostMapping("/contacts/requests/{id}/accept")
    public ResponseEntity<ContactStatusDTO> acceptRequest(
            @PathVariable("id") Long requestId,
            @RequestHeader("X-User-Id") Long currentUserId) {
        return ResponseEntity.ok(contactService.acceptRequest(requestId, currentUserId));
    }

    @PostMapping("/contacts/requests/{id}/decline")
    public ResponseEntity<ContactStatusDTO> declineRequest(
            @PathVariable("id") Long requestId,
            @RequestHeader("X-User-Id") Long currentUserId) {
        return ResponseEntity.ok(contactService.declineWithSnooze(requestId, currentUserId));
    }

    @GetMapping("/contacts/status/{otherUserId}")
    public ResponseEntity<ContactStatusDTO> getContactStatus(
            @PathVariable Long otherUserId,
            @RequestHeader("X-User-Id") Long currentUserId) {
        return ResponseEntity.ok(contactService.getContactStatus(currentUserId, otherUserId));
    }
}
