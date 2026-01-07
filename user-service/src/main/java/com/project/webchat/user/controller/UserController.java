package com.project.webchat.users.controller;

import com.project.webchat.users.dto.ChangePasswordDTO;
import com.project.webchat.users.dto.UpdateUserDTO;
import com.project.webchat.users.dto.UserDTO;
import com.project.webchat.users.security.CustomUserDetails;
import com.project.webchat.users.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/profile")
    public ResponseEntity<UserDTO> getCurrentUserProfile(
            @AuthenticationPrincipal CustomUserDetails customUserDetails) {
        UserDTO user = userService.getUserDTOById(customUserDetails.getUserId());
        return ResponseEntity.ok(user);
    }

    @PutMapping("/profile")
    public ResponseEntity<UserDTO> updateCurrentUserProfile(
            @Valid @RequestBody UpdateUserDTO updateUserDTO,
            @AuthenticationPrincipal CustomUserDetails customUserDetails) {
        UserDTO updatedUser = userService.updateUser(customUserDetails.getUserId(), updateUserDTO);
        return ResponseEntity.ok(updatedUser);
    }

    @PutMapping("/change-password")
    public ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal CustomUserDetails customUserDetails,
            @Valid @RequestBody ChangePasswordDTO changePasswordDTO) {
        userService.changePassword(customUserDetails.getUserId(), changePasswordDTO);
        return ResponseEntity.ok().build();
    }
}
