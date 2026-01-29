package com.project.webchat.user.controller;

import com.project.webchat.shared.exceptions.ResourceNotFoundException;
import com.project.webchat.user.dto.ChangePasswordDTO;
import com.project.webchat.user.dto.UpdateUserDTO;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.user.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/profile")
    public ResponseEntity<UserDTO> getCurrentUserProfile(
            @RequestHeader("X-Username") String username) {

        UserDTO user = userService.getUserDTOByUsername(username);
        return ResponseEntity.ok(user);
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateCurrentUserProfile(
            @RequestHeader("X-Username") String username,
            @Valid @RequestBody UpdateUserDTO updateUserDTO) {
        try {
            UserDTO updatedUser = userService.updateUser(username, updateUserDTO);
            return ResponseEntity.ok(updatedUser);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());}
        catch (ResourceNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }
    }

    @PutMapping("/change-password")
    public ResponseEntity<?> changePassword(
            @RequestHeader("X-Username") String username,
            @Valid @RequestBody ChangePasswordDTO changePasswordDTO) {
        userService.changePassword(username, changePasswordDTO);
        return ResponseEntity.ok().build();
    }
}
