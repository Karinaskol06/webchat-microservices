package com.project.webchat.auth.feign;

import com.project.webchat.auth.dto.RegisterRequestDTO;
import com.project.webchat.user.dto.UserDTO;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@FeignClient(name = "user-service", url = "${feign.client.user-service.url:}")
public interface UserServiceClient {

    @PostMapping("/api/users/register")
    ResponseEntity<UserDTO> registerUser(@RequestBody RegisterRequestDTO requestDTO);

    @GetMapping("/api/users/{id}")
    ResponseEntity<UserDTO> getUserById(@PathVariable("id") Long id);

    @GetMapping("/api/users/by-username/{username}")
    ResponseEntity<UserDTO> getUserByUsername(@PathVariable("username") String username);

    @GetMapping("/api/users/exists/username/{username}")
    ResponseEntity<Boolean> existsByUsername(@PathVariable("username") String username);

    @GetMapping("/api/users/exists/email/{email}")
    ResponseEntity<Boolean> existsByEmail(@PathVariable("email") String email);

    @PostMapping("/api/users/validate-credentials")
    ResponseEntity<Boolean> validateCredentials(
            @RequestParam String username,
            @RequestParam String password
    );
}
