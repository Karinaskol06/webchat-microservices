package com.project.webchat.user.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.project.webchat.shared.exceptions.ResourceNotFoundException;
import com.project.webchat.user.dto.ChangePasswordDTO;
import com.project.webchat.user.dto.UpdateUserDTO;
import com.project.webchat.shared.dto.UserDTO;
import com.project.webchat.user.entity.ProfileImage;
import com.project.webchat.user.service.ProfileImageService;
import com.project.webchat.user.service.UserService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final ProfileImageService profileImageService;
    private final ObjectMapper objectMapper;
    private final Validator validator;

    public UserController(
            UserService userService,
            ProfileImageService profileImageService,
            ObjectMapper objectMapper,
            Validator validator) {
        this.userService = userService;
        this.profileImageService = profileImageService;
        this.objectMapper = objectMapper;
        this.validator = validator;
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
            @RequestBody JsonNode payload) {
        try {
            UpdateUserDTO updateUserDTO = objectMapper.treeToValue(payload, UpdateUserDTO.class);
            Set<ConstraintViolation<UpdateUserDTO>> violations = validator.validate(updateUserDTO);
            if (!violations.isEmpty()) {
                Map<String, String> fieldErrors = new LinkedHashMap<>();
                for (ConstraintViolation<UpdateUserDTO> v : violations) {
                    fieldErrors.put(v.getPropertyPath().toString(), v.getMessage());
                }
                Map<String, Object> errorResponse = new LinkedHashMap<>();
                errorResponse.put("status", HttpStatus.BAD_REQUEST.value());
                errorResponse.put("error", "Validation Failed");
                errorResponse.put("message", "Invalid input data");
                errorResponse.put("fieldErrors", fieldErrors);
                errorResponse.put("timestamp", System.currentTimeMillis());
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
            }
            UserDTO updatedUser = userService.updateUser(username, updateUserDTO, extractProvidedFields(payload));
            return ResponseEntity.ok(updatedUser);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (ResourceNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid profile payload");
        }
    }

    @PutMapping("/change-password")
    public ResponseEntity<?> changePassword(
            @RequestHeader("X-Username") String username,
            @Valid @RequestBody ChangePasswordDTO changePasswordDTO) {
        userService.changePassword(username, changePasswordDTO);
        return ResponseEntity.ok().build();
    }

    @PostMapping(value = "/profile/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadAvatar(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam("file") MultipartFile file) {
        try {
            profileImageService.upload(userId, ProfileImageService.KIND_AVATAR, file);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/profile/avatar")
    public ResponseEntity<?> deleteAvatar(@RequestHeader("X-User-Id") Long userId) {
        profileImageService.delete(userId, ProfileImageService.KIND_AVATAR);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/profile/background", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadBackground(
            @RequestHeader("X-User-Id") Long userId,
            @RequestParam("file") MultipartFile file) {
        try {
            profileImageService.upload(userId, ProfileImageService.KIND_BACKGROUND, file);
            return ResponseEntity.ok().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/profile/background")
    public ResponseEntity<?> deleteBackground(@RequestHeader("X-User-Id") Long userId) {
        profileImageService.delete(userId, ProfileImageService.KIND_BACKGROUND);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/avatar")
    public ResponseEntity<byte[]> getAvatar(@PathVariable("id") Long userId) {
        return toImageResponse(profileImageService.load(userId, ProfileImageService.KIND_AVATAR));
    }

    @GetMapping("/{id}/background")
    public ResponseEntity<byte[]> getBackground(@PathVariable("id") Long userId) {
        return toImageResponse(profileImageService.load(userId, ProfileImageService.KIND_BACKGROUND));
    }

    private ResponseEntity<byte[]> toImageResponse(ProfileImage image) {
        if (image == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.getContentType()))
                .header(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate")
                .body(image.getData());
    }

    private Set<String> extractProvidedFields(JsonNode payload) {
        Set<String> fields = new HashSet<>();
        Iterator<String> iterator = payload.fieldNames();
        while (iterator.hasNext()) {
            fields.add(iterator.next());
        }
        return fields;
    }
}
