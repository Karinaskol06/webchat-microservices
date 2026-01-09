package com.project.webchat.user.controller;

import com.project.webchat.user.dto.RegisterRequestDTO;
import com.project.webchat.user.dto.UserDTO;
import com.project.webchat.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserServiceController {
    //endpoints for feign calls

    private final UserService userService;

    @PostMapping("/register")
    public ResponseEntity<UserDTO> register(@Valid @RequestBody RegisterRequestDTO registerRequestDTO) {
        UserDTO registered = userService.registerUser(registerRequestDTO);
        return ResponseEntity.ok(registered);
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserDTO> getUserById(@PathVariable Long id) {
        UserDTO user = userService.getUserDTOById(id);
        return ResponseEntity.ok(user);
    }

    @GetMapping("/by-username/{username}")
    public ResponseEntity<UserDTO> getUserByUsername(@PathVariable String username) {
        UserDTO user = userService.getUserDTOByUsername(username);
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

    @PostMapping("/validate-credentials")
    public ResponseEntity<Boolean> validateCredentials(
            @RequestBody String username,
            @RequestBody String password) {
        boolean isValid = userService.validateCredentials(username, password);
        return ResponseEntity.ok(isValid);
    }
}
